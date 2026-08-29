import mongoose from "mongoose";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import GameData from "@/database/gameDataSchema";
import Quiz from "@/database/quizSchema";
import Teacher from "@/database/teacherSchema";
import { averagePercent, getPostQuizPercentages, getPreQuizPercentages } from "@/lib/quizScoring";
import {
  ClassroomGameRecord,
  ClassroomParticipantRecord,
  ClassroomQuizRecord,
  ClassroomSessionRecord,
  ClassroomSessionState,
  buildClassIdBySessionId,
  buildClassroomRoster,
  bucketByParticipantSession,
  bucketBySessionOwner,
  getClassId,
  groupSessionsIntoClasses,
  resolveClassroomSessionState,
  toIdString,
} from "@/lib/server/classroomHistory";

export const ALL_SESSION_STATES: ClassroomSessionState[] = ["active", "expired", "closed"];
export const DEFAULT_ADMIN_CLASS_LIMIT = 50;

export type AdminAnalyticsFilters = {
  classId?: string;
  educatorId?: string;
  gameId?: string;
  from?: Date;
  to?: Date;
  states?: ClassroomSessionState[];
  limit?: number;
};

export type AdminClassRow = {
  classId: string;
  title: string;
  educatorId: string | null;
  educatorName: string;
  state: ClassroomSessionState;
  sessionCount: number;
  participantCount: number;
  gamesPlayed: number;
  quizzesRecorded: number;
  averagePreQuizScore: number | null;
  averagePostQuizScore: number | null;
  averageGain: number | null;
  createdAt: Date;
  lastActivityAt: Date | null;
};

export type AdminAnalytics = {
  /**
   * Every aggregate below is computed over exactly this scope. Stated explicitly because the
   * previous dashboard mixed closed-class records into totals with no way to tell.
   */
  scope: {
    includedStates: ClassroomSessionState[];
    from: Date | null;
    to: Date | null;
    gameId: string | null;
    classId: string | null;
    educatorId: string | null;
  };
  sessionCounts: Record<ClassroomSessionState, number> & { total: number };
  classCount: number;
  learners: { personal: number; classroom: number; total: number };
  gamesPlayed: number;
  quizzesRecorded: number;
  averagePreQuizScore: number | null;
  averagePostQuizScore: number | null;
  averageGain: number | null;
  classes: AdminClassRow[];
  classesTruncated: boolean;
};

function withinRange(value: Date | null | undefined, from?: Date, to?: Date) {
  if (!value) return !from && !to;
  if (from && value.getTime() < from.getTime()) return false;
  if (to && value.getTime() > to.getTime()) return false;
  return true;
}

function gainFrom(pre: number | null, post: number | null) {
  return pre === null || post === null ? null : post - pre;
}

/**
 * Classroom-aware analytics for the administrator dashboard.
 *
 * Classroom records are owned by `participant:<id>` rather than a Clerk id, which is why the
 * previous per-user table dropped them entirely. Here they are counted through the classroom
 * sessions that produced them, so classroom learners are represented without needing a personal
 * account.
 */
export async function loadAdminAnalytics(filters: AdminAnalyticsFilters = {}): Promise<AdminAnalytics> {
  const now = new Date();
  const states = filters.states?.length ? filters.states : ALL_SESSION_STATES;
  const limit = filters.limit ?? DEFAULT_ADMIN_CLASS_LIMIT;

  const sessionQuery: Record<string, unknown> = {};
  if (filters.educatorId && mongoose.Types.ObjectId.isValid(filters.educatorId)) {
    sessionQuery.teacherId = new mongoose.Types.ObjectId(filters.educatorId);
  }

  const allSessions = await ClassroomSession.find(sessionQuery)
    .select("teacherId title status createdAt expiresAt closedAt continuedFromId rootSessionId")
    .sort({ createdAt: 1 })
    .lean<Array<ClassroomSessionRecord & { _id: mongoose.Types.ObjectId; teacherId: mongoose.Types.ObjectId }>>();

  const sessionCounts = { active: 0, expired: 0, closed: 0, total: allSessions.length };
  for (const session of allSessions) {
    sessionCounts[resolveClassroomSessionState(session, now)] += 1;
  }

  // Chains are grouped before filtering so a class is judged by the state of its newest session,
  // matching how the educator history view describes it.
  let classes = groupSessionsIntoClasses(allSessions, now).filter((entry) => states.includes(entry.state));
  if (filters.classId) {
    classes = classes.filter((entry) => entry.classId === filters.classId);
  }

  const keptClassIds = new Set(classes.map((entry) => entry.classId));
  const sessions = allSessions.filter((session) => keptClassIds.has(getClassId(session)));
  const sessionObjectIds = sessions.map((session) => session._id);
  const sessionIdStrings = sessions.map((session) => String(session._id));

  const gameQuery: Record<string, unknown> = { classroomSessionId: { $in: sessionIdStrings } };
  if (filters.gameId) gameQuery.gameId = filters.gameId;

  const [participants, gameData, quizzes, teachers, personalLearnerIds] = await Promise.all([
    ClassroomParticipant.find({ sessionId: { $in: sessionObjectIds } })
      .select("sessionId participantKey displayName joinedAt lastSeenAt")
      .lean<ClassroomParticipantRecord[]>(),
    GameData.find(gameQuery)
      .select("classroomSessionId gameId lastUpdated studentDisplayName completedLevels completedStageIds")
      .lean<ClassroomGameRecord[]>(),
    Quiz.find({ classroomSessionId: { $in: sessionIdStrings } })
      .select(
        "classroomSessionId updatedAt statesOfMatterScoreBefore stateOfMatterScoreAfter penguinRunScoreBefore penguinRunScoreAfter",
      )
      .lean<ClassroomQuizRecord[]>(),
    Teacher.find({}).select("name").lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>(),
    // Personal learners are records whose owner is a Clerk id rather than a participant key.
    GameData.distinct("userId", { classroomSessionId: null }),
  ]);

  const teacherNames = new Map(teachers.map((teacher) => [String(teacher._id), teacher.name ?? "Educator"]));
  const classIdBySessionId = buildClassIdBySessionId(sessions);
  const teacherIdByClassId = new Map(
    sessions.map((session) => [getClassId(session), String(session.teacherId)] as const),
  );

  const participantsByClass = bucketByParticipantSession(participants, classIdBySessionId);
  const gameDataByClass = bucketBySessionOwner(gameData, classIdBySessionId);
  const quizzesByClass = bucketBySessionOwner(quizzes, classIdBySessionId);

  const rows: AdminClassRow[] = classes.map((classroomClass) => {
    const classParticipants = participantsByClass.get(classroomClass.classId) ?? [];
    const classGames = (gameDataByClass.get(classroomClass.classId) ?? []).filter((game) =>
      withinRange(game.lastUpdated, filters.from, filters.to),
    );
    const classQuizzes = (quizzesByClass.get(classroomClass.classId) ?? []).filter((quiz) =>
      withinRange(quiz.updatedAt ?? null, filters.from, filters.to),
    );

    const pre = classQuizzes.flatMap(getPreQuizPercentages);
    const post = classQuizzes.flatMap(getPostQuizPercentages);
    const averagePre = pre.length ? averagePercent(pre) : null;
    const averagePost = post.length ? averagePercent(post) : null;
    const timestamps = [
      ...classParticipants.map((participant) => participant.lastSeenAt),
      ...classGames.map((game) => game.lastUpdated),
      ...classQuizzes.map((quiz) => quiz.updatedAt),
    ].filter((value): value is Date => value instanceof Date);
    const educatorId = teacherIdByClassId.get(classroomClass.classId) ?? null;

    return {
      classId: classroomClass.classId,
      title: classroomClass.title,
      educatorId,
      educatorName: (educatorId && teacherNames.get(educatorId)) || "Educator",
      state: classroomClass.state,
      sessionCount: classroomClass.sessions.length,
      participantCount: buildClassroomRoster(classParticipants).length,
      gamesPlayed: classGames.length,
      quizzesRecorded: classQuizzes.length,
      averagePreQuizScore: averagePre,
      averagePostQuizScore: averagePost,
      averageGain: gainFrom(averagePre, averagePost),
      createdAt: classroomClass.createdAt,
      lastActivityAt: timestamps.length
        ? timestamps.reduce((latest, value) => (value.getTime() > latest.getTime() ? value : latest))
        : null,
    };
  });

  rows.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));

  const overallPre = rows.flatMap((row) => (row.averagePreQuizScore === null ? [] : [row.averagePreQuizScore]));
  const overallPost = rows.flatMap((row) => (row.averagePostQuizScore === null ? [] : [row.averagePostQuizScore]));
  const averagePre = overallPre.length ? averagePercent(overallPre) : null;
  const averagePost = overallPost.length ? averagePercent(overallPost) : null;

  const classroomLearners = new Set(
    participants
      .filter((participant) => keptClassIds.has(classIdBySessionId.get(toIdString(participant.sessionId) ?? "") ?? ""))
      .map((participant) => participant.participantKey),
  );

  return {
    scope: {
      includedStates: states,
      from: filters.from ?? null,
      to: filters.to ?? null,
      gameId: filters.gameId ?? null,
      classId: filters.classId ?? null,
      educatorId: filters.educatorId ?? null,
    },
    sessionCounts,
    classCount: rows.length,
    learners: {
      personal: personalLearnerIds.filter((id: unknown) => typeof id === "string" && !id.startsWith("participant:"))
        .length,
      classroom: classroomLearners.size,
      total:
        personalLearnerIds.filter((id: unknown) => typeof id === "string" && !id.startsWith("participant:")).length +
        classroomLearners.size,
    },
    gamesPlayed: rows.reduce((sum, row) => sum + row.gamesPlayed, 0),
    quizzesRecorded: rows.reduce((sum, row) => sum + row.quizzesRecorded, 0),
    averagePreQuizScore: averagePre,
    averagePostQuizScore: averagePost,
    averageGain: gainFrom(averagePre, averagePost),
    classes: rows.slice(0, limit),
    classesTruncated: rows.length > limit,
  };
}
