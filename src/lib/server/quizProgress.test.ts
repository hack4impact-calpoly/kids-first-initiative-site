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

describe("getPreviousQuizScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDataPrincipalFromCredential.mockResolvedValue({
      ok: true,
      value: { ownerId: "clerk-student", actor, classroom: null },
    });
    mocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ penguinRunScoreBefore: 1, statesOfMatterScoreBefore: 2 }),
    });
  });

  it("loads the personal player's previous score", async () => {
    await expect(getPreviousQuizScore("penguinRunQuiz", actor)).resolves.toBe(1);

    expect(mocks.resolveDataPrincipalFromCredential).toHaveBeenCalledWith(undefined, actor);
    expect(mocks.findOne).toHaveBeenCalledWith({ clerkId: "clerk-student" });
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
    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});
