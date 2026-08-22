import { describe, expect, it } from "vitest";
import {
  ClassroomParticipantRecord,
  ClassroomSessionRecord,
  buildClassIdBySessionId,
  buildClassroomActivity,
  buildClassroomRoster,
  bucketBySessionOwner,
  getClassId,
  groupSessionsIntoClasses,
  resolveClassroomSessionState,
  summarizeClassroomClass,
  toClassroomGameView,
  toClassroomQuizView,
  toClassroomRosterView,
} from "@/lib/server/classroomHistory";

const NOW = new Date("2026-08-22T18:00:00.000Z");

function session(overrides: Partial<ClassroomSessionRecord> & { _id: string }): ClassroomSessionRecord {
  return {
    title: "4th Grade Science",
    status: "closed",
    createdAt: new Date("2026-08-20T09:00:00.000Z"),
    expiresAt: new Date("2026-08-20T17:00:00.000Z"),
    closedAt: null,
    continuedFromId: null,
    rootSessionId: null,
    ...overrides,
  };
}

function participant(overrides: Partial<ClassroomParticipantRecord> & { _id: string }): ClassroomParticipantRecord {
  return {
    sessionId: "root",
    participantKey: "guest:abc",
    displayName: "Ada",
    joinedAt: new Date("2026-08-20T09:05:00.000Z"),
    lastSeenAt: new Date("2026-08-20T09:30:00.000Z"),
    ...overrides,
  };
}

describe("resolveClassroomSessionState", () => {
  it("separates closed sessions from ones that merely ran out the clock", () => {
    const stillRunning = { status: "active" as const, expiresAt: new Date(NOW.getTime() + 60_000) };
    const ranOut = { status: "active" as const, expiresAt: new Date(NOW.getTime() - 60_000) };
    const endedEarly = { status: "closed" as const, expiresAt: new Date(NOW.getTime() + 60_000) };

    expect(resolveClassroomSessionState(stillRunning, NOW)).toBe("active");
    expect(resolveClassroomSessionState(ranOut, NOW)).toBe("expired");
    expect(resolveClassroomSessionState(endedEarly, NOW)).toBe("closed");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(resolveClassroomSessionState({ status: "active", expiresAt: NOW }, NOW)).toBe("expired");
  });
});

describe("getClassId", () => {
  it("addresses an original session by its own id and a continuation by its root", () => {
    expect(getClassId(session({ _id: "root" }))).toBe("root");
    expect(getClassId(session({ _id: "continuation", rootSessionId: "root" }))).toBe("root");
  });
});

describe("groupSessionsIntoClasses", () => {
  const root = session({ _id: "root", closedAt: new Date("2026-08-20T17:00:00.000Z") });
  const continuation = session({
    _id: "continuation",
    rootSessionId: "root",
    status: "active",
    createdAt: new Date("2026-08-22T14:00:00.000Z"),
    expiresAt: new Date("2026-08-22T22:00:00.000Z"),
    title: "4th Grade Science",
  });
  // Never explicitly closed, but its 8-hour window elapsed.
  const otherClass = session({
    _id: "other",
    title: "Period 2",
    status: "active",
    createdAt: new Date("2026-08-21T09:00:00.000Z"),
    expiresAt: new Date("2026-08-21T17:00:00.000Z"),
  });

  it("collapses a continuation chain into one class described by its newest session", () => {
    const [first, second] = groupSessionsIntoClasses([root, otherClass, continuation], NOW);

    expect(first.classId).toBe("root");
    expect(first.sessions.map((entry) => String(entry._id))).toEqual(["root", "continuation"]);
    expect(first.state).toBe("active");
    expect(first.reopenCount).toBe(1);
    // The class started when its original session opened, not when it was last reopened.
    expect(first.createdAt).toEqual(root.createdAt);
    expect(first.expiresAt).toEqual(continuation.expiresAt);

    expect(second.classId).toBe("other");
    expect(second.reopenCount).toBe(0);
    expect(second.state).toBe("expired");
  });

  it("orders classes by most recent session first", () => {
    expect(groupSessionsIntoClasses([root, otherClass, continuation], NOW).map((entry) => entry.classId)).toEqual([
      "root",
      "other",
    ]);
  });
});

describe("buildClassroomRoster", () => {
  it("keeps a returning student as one roster entry across reopened sessions", () => {
    const roster = buildClassroomRoster([
      participant({ _id: "p1", sessionId: "root", participantKey: "guest:abc", displayName: "Ada" }),
      participant({
        _id: "p2",
        sessionId: "continuation",
        participantKey: "guest:abc",
        displayName: "Ada L.",
        joinedAt: new Date("2026-08-22T14:05:00.000Z"),
        lastSeenAt: new Date("2026-08-22T15:00:00.000Z"),
      }),
      participant({
        _id: "p3",
        sessionId: "continuation",
        participantKey: "clerk:user_2",
        displayName: "Grace",
        joinedAt: new Date("2026-08-22T14:10:00.000Z"),
        lastSeenAt: new Date("2026-08-22T14:40:00.000Z"),
      }),
    ]);

    expect(roster).toHaveLength(2);

    const [ada, grace] = roster;
    expect(ada.participantIds).toEqual(["p1", "p2"]);
    expect(ada.sessionIds).toEqual(["root", "continuation"]);
    // Earliest join and latest sighting win, and the newest sighting supplies the display name.
    expect(ada.joinedAt).toEqual(new Date("2026-08-20T09:05:00.000Z"));
    expect(ada.lastSeenAt).toEqual(new Date("2026-08-22T15:00:00.000Z"));
    expect(ada.displayName).toBe("Ada L.");

    expect(grace.participantKey).toBe("clerk:user_2");
    expect(grace.sessionIds).toEqual(["continuation"]);
  });
});

describe("summarizeClassroomClass", () => {
  const classroomClass = groupSessionsIntoClasses(
    [
      session({ _id: "root", closedAt: new Date("2026-08-20T17:00:00.000Z") }),
      session({
        _id: "continuation",
        rootSessionId: "root",
        status: "active",
        createdAt: new Date("2026-08-22T14:00:00.000Z"),
        expiresAt: new Date("2026-08-22T22:00:00.000Z"),
      }),
    ],
    NOW,
  )[0];

  const input = {
    participants: [
      participant({ _id: "p1", sessionId: "root", participantKey: "guest:abc" }),
      participant({
        _id: "p2",
        sessionId: "continuation",
        participantKey: "guest:abc",
        lastSeenAt: new Date("2026-08-22T15:00:00.000Z"),
      }),
    ],
    accessCodes: [
      { _id: "c1", sessionId: "root", code: "OLDCODE-1A2", isActive: false, createdAt: NOW, lastSeenAt: null },
      { _id: "c2", sessionId: "continuation", code: "NEWCODE-9Z8", isActive: true, createdAt: NOW, lastSeenAt: null },
    ],
    gameData: [
      {
        _id: "g1",
        classroomSessionId: "root",
        gameId: "statesOfMatterGame",
        lastUpdated: new Date("2026-08-20T10:00:00.000Z"),
      },
    ],
    // 3 questions per quiz: 1/3 -> 33.3%, 3/3 -> 100%.
    quizzes: [
      {
        _id: "q1",
        classroomSessionId: "root",
        statesOfMatterScoreBefore: 1,
        stateOfMatterScoreAfter: 3,
        penguinRunScoreBefore: -1,
        penguinRunScoreAfter: -1,
        updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      },
    ],
  };

  it("reports the merged roster count and the code attached to the newest session", () => {
    const summary = summarizeClassroomClass(classroomClass, input);

    expect(summary.participantCount).toBe(1);
    expect(summary.gamesPlayed).toBe(1);
    expect(summary.quizzesRecorded).toBe(1);
    expect(summary.activeAccessCode).toBe("NEWCODE-9Z8");
    expect(summary.lastActivityAt).toEqual(new Date("2026-08-22T15:00:00.000Z"));
    expect(summary.averagePreQuizScore).toBeCloseTo(100 / 3);
    expect(summary.averagePostQuizScore).toBe(100);
  });

  it("reports no active code once the newest session is no longer live", () => {
    const closedClass = groupSessionsIntoClasses([session({ _id: "root" })], NOW)[0];
    const summary = summarizeClassroomClass(closedClass, {
      ...input,
      accessCodes: [{ _id: "c1", sessionId: "root", code: "OLDCODE-1A2", isActive: true, createdAt: NOW }],
    });

    expect(summary.state).toBe("closed");
    expect(summary.activeAccessCode).toBeNull();
  });

  it("distinguishes an unmeasured average from a zero average", () => {
    const summary = summarizeClassroomClass(classroomClass, { ...input, quizzes: [] });

    expect(summary.averagePreQuizScore).toBeNull();
    expect(summary.averagePostQuizScore).toBeNull();
  });
});

describe("bucketBySessionOwner", () => {
  it("routes records from every session in a chain to the class that owns them", () => {
    const sessions = [
      session({ _id: "root" }),
      session({ _id: "continuation", rootSessionId: "root" }),
      session({ _id: "other" }),
    ];
    const buckets = bucketBySessionOwner(
      [
        { _id: "a", classroomSessionId: "root" },
        { _id: "b", classroomSessionId: "continuation" },
        { _id: "c", classroomSessionId: "other" },
        { _id: "d", classroomSessionId: "unknown-session" },
        { _id: "e", classroomSessionId: null },
      ],
      buildClassIdBySessionId(sessions),
    );

    expect(buckets.get("root")?.map((entry) => entry._id)).toEqual(["a", "b"]);
    expect(buckets.get("other")?.map((entry) => entry._id)).toEqual(["c"]);
    // Records pointing at sessions outside this teacher's classes are dropped, not misfiled.
    expect(buckets.has("unknown-session")).toBe(false);
  });
});

describe("buildClassroomActivity", () => {
  it("merges joins, game saves, and quiz results newest first", () => {
    const activity = buildClassroomActivity({
      classTitle: "4th Grade Science",
      participants: [participant({ _id: "p1" })],
      gameData: [
        {
          _id: "g1",
          gameId: "statesOfMatterGame",
          lastUpdated: new Date("2026-08-20T10:00:00.000Z"),
          studentDisplayName: "Ada",
        },
      ],
      quizzes: [
        {
          _id: "q1",
          studentDisplayName: "Ada",
          stateOfMatterScoreAfter: 3,
          statesOfMatterScoreBefore: -1,
          penguinRunScoreBefore: -1,
          penguinRunScoreAfter: -1,
          updatedAt: new Date("2026-08-20T11:00:00.000Z"),
        },
      ],
    });

    expect(activity.map((item) => item.description)).toEqual([
      "Ada completed States of Matter post-quiz with 100%.",
      "Ada played States of Matter.",
      "Ada joined 4th Grade Science.",
    ]);
  });

  it("skips quiz records that have no timestamp to place them on", () => {
    const activity = buildClassroomActivity({
      classTitle: "4th Grade Science",
      participants: [],
      gameData: [],
      quizzes: [{ _id: "q1", stateOfMatterScoreAfter: 3 }],
    });

    expect(activity).toEqual([]);
  });
});

describe("serializable views", () => {
  it("strips identity and answer detail that must not leave the server", () => {
    const rosterView = toClassroomRosterView({
      // participantKey embeds the student's Clerk id verbatim.
      participantKey: "clerk:user_2abcXYZ",
      participantIds: ["p1", "p2"],
      displayName: "Ada",
      joinedAt: new Date("2026-08-20T09:05:00.000Z"),
      lastSeenAt: new Date("2026-08-22T15:00:00.000Z"),
      sessionIds: ["root", "continuation"],
    });

    expect(rosterView).toEqual({
      id: "p1",
      displayName: "Ada",
      joinedAt: new Date("2026-08-20T09:05:00.000Z"),
      lastSeenAt: new Date("2026-08-22T15:00:00.000Z"),
      sessionCount: 2,
    });
    expect(JSON.stringify(rosterView)).not.toContain("user_2abcXYZ");

    const quizView = toClassroomQuizView({
      _id: "q1",
      studentDisplayName: "Ada",
      completed: true,
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      statesOfMatterScoreBefore: 1,
      stateOfMatterScoreAfter: 3,
      penguinRunScoreBefore: -1,
      penguinRunScoreAfter: -1,
      ...({
        clerkId: "user_2abcXYZ",
        quizId: "quiz-user_2abcXYZ",
        statesOfMatterQuestionResults: [{ selectedAnswer: "Solid" }],
      } as object),
    });

    expect(Object.keys(quizView).sort()).toEqual([
      "completed",
      "id",
      "penguinRunScoreAfter",
      "penguinRunScoreBefore",
      "stateOfMatterScoreAfter",
      "statesOfMatterScoreBefore",
      "studentDisplayName",
      "updatedAt",
    ]);
    expect(JSON.stringify(quizView)).not.toContain("user_2abcXYZ");
    expect(JSON.stringify(quizView)).not.toContain("Solid");

    const gameView = toClassroomGameView({
      _id: "g1",
      gameId: "statesOfMatterGame",
      lastUpdated: new Date("2026-08-20T10:00:00.000Z"),
      studentDisplayName: "Ada",
      completedLevels: [1, 2],
      completedStageIds: ["a"],
      ...({ userId: "user_2abcXYZ", saveId: "save-1" } as object),
    });

    expect(gameView).toEqual({
      id: "g1",
      gameId: "statesOfMatterGame",
      gameLabel: "States of Matter",
      studentDisplayName: "Ada",
      completedLevelCount: 2,
      completedStageCount: 1,
      lastUpdated: new Date("2026-08-20T10:00:00.000Z"),
    });
    expect(JSON.stringify(gameView)).not.toContain("user_2abcXYZ");
  });
});
