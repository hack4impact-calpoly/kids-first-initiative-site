import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestActor } from "@/lib/server/apiAuthorization";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
  resolveClassroomOwnerKeys: vi.fn(),
  resolveDataPrincipalFromCredential: vi.fn(),
}));

vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/quizSchema", () => ({ default: { find: mocks.find } }));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  resolveDataPrincipalFromCredential: mocks.resolveDataPrincipalFromCredential,
  resolveClassroomOwnerKeys: mocks.resolveClassroomOwnerKeys,
}));

import { getPreviousQuizScore } from "@/lib/server/quizProgress";

const actor: RequestActor = { userId: "clerk-student", role: "player" };

/** Answers `Quiz.find` with one row per owner key, so a test can give different owners different scores. */
function stubQuizzesByOwner(byOwner: Record<string, Record<string, number>>) {
  const rows = Object.entries(byOwner).map(([clerkId, scores]) => ({ clerkId, ...scores }));
  mocks.find.mockReturnValue({ select: () => ({ lean: vi.fn().mockResolvedValue(rows) }) });
}

describe("getPreviousQuizScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "clerk-student", actor, classroom: null },
    });
    mocks.resolveClassroomOwnerKeys.mockImplementation(async (classroom: { participantId: string }) => [
      `participant:${classroom.participantId}`,
    ]);
    stubQuizzesByOwner({ "clerk-student": { penguinRunScoreBefore: 1, statesOfMatterScoreBefore: 2 } });
  });

  it("loads the personal player's previous score", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith(undefined, actor, undefined);
    expect(mocks.find).toHaveBeenCalledWith({ clerkId: { $in: ["clerk-student"] } });
  });

  it("opens the database connection before resolving the principal", async () => {
    // The resolver queries participants and sessions itself, so connecting afterwards would leave
    // that query buffering on a cold instance until mongoose times out.
    await getPreviousQuizScore("penguinRunQuiz", actor);

    expect(mocks.connectDB).toHaveBeenCalled();
    expect(mocks.connectDB.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolveDataPrincipalFromCredential.mock.invocationCallOrder[0],
    );
  });

  it("loads a classroom participant's previous score by the authorized participant owner", async () => {
    const classroomActor: RequestActor = { userId: null, role: null };
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: {
        ownerId: "participant:participant-1",
        actor: classroomActor,
        classroom: {
          participantId: "participant-1",
          sessionId: "session-1",
          displayName: "Student",
          clerkId: null,
        },
      },
    });
    stubQuizzesByOwner({ "participant:participant-1": { statesOfMatterScoreBefore: 2 } });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", classroomActor, "opaque-cookie")).resolves.toBe(2);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith("opaque-cookie", classroomActor, undefined);
    expect(mocks.find).toHaveBeenCalledWith({ clerkId: { $in: ["participant:participant-1"] } });
  });

  it("returns no score without querying quiz data when the credential is unauthorized", async () => {
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    await expect(getPreviousQuizScore("penguinRunQuiz", { userId: null, role: null }, "expired-cookie")).resolves.toBe(
      -1,
    );
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("degrades to no previous score instead of failing the page when the principal cannot be resolved", async () => {
    mocks.resolveDataPrincipalFromCredential.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(-1);

    consoleError.mockRestore();
  });

  it("forwards the carried classroom participant so the read matches the write owner", async () => {
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: {
        ownerId: "participant:participant-7",
        actor,
        classroom: { participantId: "participant-7", sessionId: "s1", displayName: "Ada", clerkId: "clerk-student" },
      },
    });
    stubQuizzesByOwner({ "participant:participant-7": { statesOfMatterScoreBefore: 2 } });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, undefined, "participant-7")).resolves.toBe(2);

    // The claim is validated by the same path the write uses, not trusted on its own.
    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith(undefined, actor, "participant-7");
    expect(mocks.find).toHaveBeenCalledWith({ clerkId: { $in: ["participant:participant-7"] } });
  });

  it("returns no score when a carried participant fails authorization", async () => {
    // A forged or stale participantId in the URL must not fall back to another record.
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, undefined, "someone-elses-id")).resolves.toBe(-1);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("still resolves from the cookie alone when no participant is carried", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor, "opaque-cookie")).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith("opaque-cookie", actor, undefined);
  });

  it("finds a baseline recorded before the class was reopened", async () => {
    const classroom = { participantId: "participant-new", sessionId: "s2", displayName: "Ada", clerkId: null };
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "participant:participant-new", actor, classroom },
    });
    // Rejoining a reopened class produces a new participant row, so the baseline sits under the
    // earlier key while the new row has nothing yet.
    mocks.resolveClassroomOwnerKeys.mockResolvedValue(["participant:participant-new", "participant:participant-old"]);
    stubQuizzesByOwner({ "participant:participant-old": { statesOfMatterScoreBefore: 2 } });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, "cookie")).resolves.toBe(2);
    expect(mocks.find).toHaveBeenCalledWith({
      clerkId: { $in: ["participant:participant-new", "participant:participant-old"] },
    });
  });

  it("prefers the current participant's score over an earlier one", async () => {
    const classroom = { participantId: "participant-new", sessionId: "s2", displayName: "Ada", clerkId: null };
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "participant:participant-new", actor, classroom },
    });
    mocks.resolveClassroomOwnerKeys.mockResolvedValue(["participant:participant-new", "participant:participant-old"]);
    stubQuizzesByOwner({
      "participant:participant-new": { statesOfMatterScoreBefore: 1 },
      "participant:participant-old": { statesOfMatterScoreBefore: 3 },
    });

    // Lineage is a fallback, not a merge: a baseline retaken in the reopened class wins.
    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, "cookie")).resolves.toBe(1);
  });

  it("skips an unattempted earlier score rather than returning -1 from it", async () => {
    const classroom = { participantId: "participant-new", sessionId: "s2", displayName: "Ada", clerkId: null };
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "participant:participant-new", actor, classroom },
    });
    mocks.resolveClassroomOwnerKeys.mockResolvedValue(["participant:participant-new", "participant:participant-old"]);
    stubQuizzesByOwner({
      "participant:participant-new": { statesOfMatterScoreBefore: -1 },
      "participant:participant-old": { statesOfMatterScoreBefore: 3 },
    });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, "cookie")).resolves.toBe(3);
  });

  it("does not resolve lineage for a personal player", async () => {
    await getPreviousQuizScore("penguinRunQuiz", actor);

    expect(mocks.resolveClassroomOwnerKeys).not.toHaveBeenCalled();
  });

  it("degrades to no previous score when the quiz lookup itself fails", async () => {
    // Covers the second await inside the try block, not just the first.
    mocks.find.mockReturnValue({ select: () => ({ lean: vi.fn().mockRejectedValue(new Error("read timeout")) }) });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(-1);

    consoleError.mockRestore();
  });
});
