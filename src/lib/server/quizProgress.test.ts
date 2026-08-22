import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestActor } from "@/lib/server/apiAuthorization";

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findOne: vi.fn(),
  resolveDataPrincipalFromCredential: vi.fn(),
  findActiveClassroomParticipantForUser: vi.fn(),
}));

vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/database/quizSchema", () => ({ default: { findOne: mocks.findOne } }));
vi.mock("@/lib/server/classroomAuthorization", () => ({
  resolveDataPrincipalFromCredential: mocks.resolveDataPrincipalFromCredential,
  findActiveClassroomParticipantForUser: mocks.findActiveClassroomParticipantForUser,
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
    mocks.findActiveClassroomParticipantForUser.mockResolvedValue(null);
    stubQuizzesByOwner({ "clerk-student": { penguinRunScoreBefore: 1, statesOfMatterScoreBefore: 2 } });
  });

  it("loads the personal player's previous score", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith(undefined, actor);
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

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith("opaque-cookie", classroomActor);
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

  it("recovers the classroom baseline when the cookie lapsed but the participant is still active", async () => {
    stubQuizzesByOwner({
      "clerk-student": { statesOfMatterScoreBefore: -1 },
      "participant:participant-9": { statesOfMatterScoreBefore: 2 },
    });
    mocks.findActiveClassroomParticipantForUser.mockResolvedValue({
      participantId: "participant-9",
      sessionId: "session-1",
      displayName: "Student",
      clerkId: "clerk-student",
    });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor)).resolves.toBe(2);
    expect(mocks.findActiveClassroomParticipantForUser).toHaveBeenCalledWith("clerk-student");
  });

  it("never lets a classroom baseline override a real personal score", async () => {
    stubQuizzesByOwner({
      "clerk-student": { statesOfMatterScoreBefore: 3 },
      "participant:participant-9": { statesOfMatterScoreBefore: 0 },
    });
    mocks.findActiveClassroomParticipantForUser.mockResolvedValue({
      participantId: "participant-9",
      sessionId: "session-1",
      displayName: "Student",
      clerkId: "clerk-student",
    });

    await expect(getPreviousQuizScore("statesOfMatterQuiz", actor)).resolves.toBe(3);
    expect(mocks.findActiveClassroomParticipantForUser).not.toHaveBeenCalled();
  });

  it("does not look for a classroom fallback for an anonymous caller", async () => {
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "participant:participant-1", actor: { userId: null, role: null }, classroom: null },
    });
    stubQuizzesByOwner({});

    await expect(getPreviousQuizScore("penguinRunQuiz", { userId: null, role: null })).resolves.toBe(-1);
    expect(mocks.findActiveClassroomParticipantForUser).not.toHaveBeenCalled();
  });

  it("degrades to no previous score instead of failing the page when the database errors", async () => {
    mocks.resolveDataPrincipalFromCredential.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(-1);

    consoleError.mockRestore();
  });
});
