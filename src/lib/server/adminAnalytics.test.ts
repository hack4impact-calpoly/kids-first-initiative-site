import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFind: vi.fn(),
  participantFind: vi.fn(),
  gameFind: vi.fn(),
  gameDistinct: vi.fn(),
  quizFind: vi.fn(),
  teacherFind: vi.fn(),
}));

vi.mock("@/database/classroomSessionSchema", () => ({ default: { find: mocks.sessionFind } }));
vi.mock("@/database/classroomParticipantSchema", () => ({ default: { find: mocks.participantFind } }));
vi.mock("@/database/gameDataSchema", () => ({ default: { find: mocks.gameFind, distinct: mocks.gameDistinct } }));
vi.mock("@/database/quizSchema", () => ({ default: { find: mocks.quizFind } }));
vi.mock("@/database/teacherSchema", () => ({ default: { find: mocks.teacherFind } }));

import { loadAdminAnalytics } from "@/lib/server/adminAnalytics";

const NOW_ISH = new Date();
const TEACHER = new mongoose.Types.ObjectId();
const LIVE_ROOT = new mongoose.Types.ObjectId();
const CLOSED_ROOT = new mongoose.Types.ObjectId();

const liveSession = {
  _id: LIVE_ROOT,
  teacherId: TEACHER,
  title: "Period 1",
  status: "active" as const,
  createdAt: new Date(NOW_ISH.getTime() - 3_600_000),
  expiresAt: new Date(NOW_ISH.getTime() + 3_600_000),
  closedAt: null,
  rootSessionId: null,
};

const closedSession = {
  _id: CLOSED_ROOT,
  teacherId: TEACHER,
  title: "Period 2",
  status: "closed" as const,
  createdAt: new Date(NOW_ISH.getTime() - 7_200_000),
  expiresAt: new Date(NOW_ISH.getTime() - 3_600_000),
  closedAt: new Date(NOW_ISH.getTime() - 3_600_000),
  rootSessionId: null,
};

function selectSortLean(value: unknown) {
  return { select: () => ({ sort: () => ({ lean: async () => value }) }) };
}
function selectLean(value: unknown) {
  return { select: () => ({ lean: async () => value }) };
}

describe("loadAdminAnalytics", () => {
  beforeEach(() => {
    mocks.sessionFind.mockReturnValue(selectSortLean([liveSession, closedSession]));
    mocks.participantFind.mockReturnValue(
      selectLean([
        {
          _id: "p1",
          sessionId: LIVE_ROOT,
          participantKey: "clerk:student-a",
          displayName: "A",
          joinedAt: NOW_ISH,
          lastSeenAt: NOW_ISH,
        },
        {
          _id: "p2",
          sessionId: CLOSED_ROOT,
          participantKey: "guest:student-b",
          displayName: "B",
          joinedAt: NOW_ISH,
          lastSeenAt: NOW_ISH,
        },
      ]),
    );
    mocks.gameFind.mockReturnValue(
      selectLean([
        { _id: "g1", classroomSessionId: String(LIVE_ROOT), gameId: "penguinRunGame", lastUpdated: NOW_ISH },
        { _id: "g2", classroomSessionId: String(CLOSED_ROOT), gameId: "statesOfMatterGame", lastUpdated: NOW_ISH },
      ]),
    );
    mocks.quizFind.mockReturnValue(
      selectLean([
        {
          _id: "q1",
          classroomSessionId: String(LIVE_ROOT),
          statesOfMatterScoreBefore: 1,
          stateOfMatterScoreAfter: 3,
          penguinRunScoreBefore: -1,
          penguinRunScoreAfter: -1,
          updatedAt: NOW_ISH,
        },
      ]),
    );
    mocks.teacherFind.mockReturnValue(selectLean([{ _id: TEACHER, name: "Ms Rivera" }]));
    mocks.gameDistinct.mockResolvedValue(["clerk_personal_1", "clerk_personal_2"]);
  });

  it("counts active, closed, and expired sessions separately", async () => {
    const analytics = await loadAdminAnalytics();

    expect(analytics.sessionCounts).toMatchObject({ active: 1, closed: 1, expired: 0, total: 2 });
  });

  it("states the scope its aggregates were computed over", async () => {
    const analytics = await loadAdminAnalytics();

    // The old dashboard mixed closed-class records into totals with no way to tell.
    expect(analytics.scope.includedStates).toEqual(["active", "expired", "closed"]);
  });

  it("counts classroom learners without requiring a personal account", async () => {
    const analytics = await loadAdminAnalytics();

    // Both a signed-in and a guest participant count, and neither is a Clerk user record.
    expect(analytics.learners).toMatchObject({ classroom: 2, personal: 2, total: 4 });
  });

  it("excludes closed classes from aggregates when the scope asks for active only", async () => {
    const analytics = await loadAdminAnalytics({ states: ["active"] });

    expect(analytics.scope.includedStates).toEqual(["active"]);
    expect(analytics.classCount).toBe(1);
    expect(analytics.classes[0].title).toBe("Period 1");
    // Session counts describe the whole system, so they stay unfiltered.
    expect(analytics.sessionCounts.total).toBe(2);
    expect(analytics.gamesPlayed).toBe(1);
  });

  it("attributes each class to its educator", async () => {
    const analytics = await loadAdminAnalytics();

    expect(analytics.classes.every((row) => row.educatorName === "Ms Rivera")).toBe(true);
  });

  it("reports a pre-to-post gain per class and overall", async () => {
    const analytics = await loadAdminAnalytics({ states: ["active"] });

    // 1/3 -> 3/3 is 33.3% -> 100%.
    expect(analytics.classes[0].averagePreQuizScore).toBeCloseTo(100 / 3);
    expect(analytics.classes[0].averagePostQuizScore).toBe(100);
    expect(analytics.classes[0].averageGain).toBeCloseTo(100 - 100 / 3);
    expect(analytics.averageGain).toBeCloseTo(100 - 100 / 3);
  });

  it("reports no gain rather than zero when nothing was measured", async () => {
    mocks.quizFind.mockReturnValue(selectLean([]));

    const analytics = await loadAdminAnalytics();

    expect(analytics.averagePreQuizScore).toBeNull();
    expect(analytics.averageGain).toBeNull();
  });

  it("filters game records by game when asked", async () => {
    await loadAdminAnalytics({ gameId: "penguinRunGame" });

    expect(mocks.gameFind).toHaveBeenCalledWith(expect.objectContaining({ gameId: "penguinRunGame" }));
  });

  it("narrows to one class when given a class id", async () => {
    const analytics = await loadAdminAnalytics({ classId: String(CLOSED_ROOT) });

    expect(analytics.classCount).toBe(1);
    expect(analytics.classes[0].classId).toBe(String(CLOSED_ROOT));
  });

  it("reports truncation instead of silently dropping classes", async () => {
    const analytics = await loadAdminAnalytics({ limit: 1 });

    expect(analytics.classes).toHaveLength(1);
    expect(analytics.classesTruncated).toBe(true);
  });
});
