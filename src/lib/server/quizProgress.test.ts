import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestActor } from "@/lib/server/apiAuthorization";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findOne: vi.fn(),
  resolveDataPrincipalFromCredential: vi.fn(),
}));

vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/quizSchema", () => ({ default: { findOne: mocks.findOne } }));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  resolveDataPrincipalFromCredential: mocks.resolveDataPrincipalFromCredential,
}));

import { getPreviousQuizScore } from "@/lib/server/quizProgress";

const actor: RequestActor = { userId: "clerk-student", role: "player" };

/** Answers `Quiz.findOne` per owner key, so a test can give the personal and participant records different scores. */
function stubQuizzesByOwner(byOwner: Record<string, unknown>) {
  mocks.findOne.mockImplementation((filter: { clerkId: string }) => ({
    lean: vi.fn().mockResolvedValue(byOwner[filter.clerkId] ?? null),
  }));
}

describe("getPreviousQuizScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "clerk-student", actor, classroom: null },
    });
    stubQuizzesByOwner({ "clerk-student": { penguinRunScoreBefore: 1, statesOfMatterScoreBefore: 2 } });
  });

  it("loads the personal player's previous score", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith(undefined, actor, undefined);
    expect(mocks.findOne).toHaveBeenCalledWith({ clerkId: "clerk-student" });
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
    expect(mocks.findOne).toHaveBeenCalledWith({ clerkId: "participant:participant-1" });
  });

  it("returns no score without querying quiz data when the credential is unauthorized", async () => {
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    await expect(getPreviousQuizScore("penguinRunQuiz", { userId: null, role: null }, "expired-cookie")).resolves.toBe(
      -1,
    );
    expect(mocks.findOne).not.toHaveBeenCalled();
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
    expect(mocks.findOne).toHaveBeenCalledWith({ clerkId: "participant:participant-7" });
  });

  it("returns no score when a carried participant fails authorization", async () => {
    // A forged or stale participantId in the URL must not fall back to another record.
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor, undefined, "someone-elses-id")).resolves.toBe(-1);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("still resolves from the cookie alone when no participant is carried", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor, "opaque-cookie")).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith("opaque-cookie", actor, undefined);
  });

  it("degrades to no previous score when the quiz lookup itself fails", async () => {
    // Covers the second await inside the try block, not just the first.
    mocks.findOne.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error("read timeout")) });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(-1);

    consoleError.mockRestore();
  });
});
