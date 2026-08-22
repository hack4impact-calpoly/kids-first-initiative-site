import mongoose from "mongoose";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import GameData from "@/database/gameDataSchema";
import Quiz from "@/database/quizSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import {
  ClassroomAccessCodeRecord,
  ClassroomClassSummary,
  ClassroomGameRecord,
  ClassroomParticipantRecord,
  ClassroomQuizRecord,
  ClassroomRosterEntry,
  ClassroomSessionRecord,
  ClassroomSessionState,
  buildClassIdBySessionId,
  buildClassroomActivity,
  buildClassroomRoster,
  bucketByParticipantSession,
  bucketBySessionOwner,
  getClassId,
  groupSessionsIntoClasses,
  resolveClassroomSessionState,
  summarizeClassroomClass,
  toIdString,
} from "@/lib/server/classroomHistory";
import { SESSION_DURATION_MS, closeActiveClassroomSessions, issueAccessCode } from "@/lib/server/educatorClassroom";

export type ClassroomClassDetail = {
  summary: ClassroomClassSummary;
  roster: ClassroomRosterEntry[];
  sessionStates: Array<{
    sessionId: string;
    title: string;
    state: ClassroomSessionState;
    createdAt: Date;
    expiresAt: Date;
    closedAt: Date | null;
    accessCodes: Array<{ code: string; isActive: boolean; createdAt: Date; lastSeenAt: Date | null }>;
  }>;
  gameData: ClassroomGameRecord[];
  quizzes: ClassroomQuizRecord[];
  activity: ReturnType<typeof buildClassroomActivity>;
};

export type ReopenClassroomResult =
  | { ok: false; reason: "invalid" | "not_found" }
  | { ok: true; reopened: boolean; classId: string; sessionId: string; accessCode: string | null; expiresAt: Date };

function toSessionIdStrings(sessions: Array<{ _id: mongoose.Types.ObjectId }>) {
  return sessions.map((session) => String(session._id));
}

async function loadClassroomRecords(sessions: Array<{ _id: mongoose.Types.ObjectId }>) {
  const objectIds = sessions.map((session) => session._id);
  const sessionIds = toSessionIdStrings(sessions);

  return Promise.all([
    ClassroomParticipant.find({ sessionId: { $in: objectIds } })
      .sort({ joinedAt: 1 })
      .lean<ClassroomParticipantRecord[]>(),
    StudentAccessCode.find({ sessionId: { $in: objectIds } })
      .sort({ createdAt: 1 })
      .lean<ClassroomAccessCodeRecord[]>(),
    GameData.find({ classroomSessionId: { $in: sessionIds } })
      .sort({ lastUpdated: -1 })
      .lean<ClassroomGameRecord[]>(),
    Quiz.find({ classroomSessionId: { $in: sessionIds } })
      .sort({ updatedAt: -1 })
      .lean<ClassroomQuizRecord[]>(),
  ]);
}

export async function loadTeacherClassSummaries(
  teacherId: mongoose.Types.ObjectId | string,
  now: Date = new Date(),
): Promise<ClassroomClassSummary[]> {
  const sessions = await ClassroomSession.find({ teacherId })
    .sort({ createdAt: 1 })
    .lean<Array<ClassroomSessionRecord & { _id: mongoose.Types.ObjectId }>>();

  if (sessions.length === 0) return [];

  const [participants, accessCodes, gameData, quizzes] = await loadClassroomRecords(sessions);
  const classIdBySessionId = buildClassIdBySessionId(sessions);
  const participantsByClass = bucketByParticipantSession(participants, classIdBySessionId);
  const accessCodesByClass = bucketByParticipantSession(accessCodes, classIdBySessionId);
  const gameDataByClass = bucketBySessionOwner(gameData, classIdBySessionId);
  const quizzesByClass = bucketBySessionOwner(quizzes, classIdBySessionId);

  return groupSessionsIntoClasses(sessions, now).map((classroomClass) =>
    summarizeClassroomClass(classroomClass, {
      participants: participantsByClass.get(classroomClass.classId) ?? [],
      accessCodes: accessCodesByClass.get(classroomClass.classId) ?? [],
      gameData: gameDataByClass.get(classroomClass.classId) ?? [],
      quizzes: quizzesByClass.get(classroomClass.classId) ?? [],
    }),
  );
}

/**
 * A class is addressed by the id of the session that started it, but educators reach it through
 * links and saved ids that may point at any session in the chain. Normalizing to the chain root
 * first keeps every caller consistent regardless of which session id it was handed.
 */
export async function resolveClassRootId(classId: string, teacherId: mongoose.Types.ObjectId | string | null) {
  if (!mongoose.Types.ObjectId.isValid(classId)) return null;

  const session = await ClassroomSession.findOne({
    _id: new mongoose.Types.ObjectId(classId),
    ...(teacherId ? { teacherId } : {}),
  }).lean<{ _id: mongoose.Types.ObjectId; rootSessionId?: mongoose.Types.ObjectId | null } | null>();

  return session ? getClassId(session) : null;
}

/**
 * Loads every session in a class's continuation chain. `teacherId` scopes the read to one educator;
 * pass null only for an actor that has already been authorized to read across educators.
 */
async function findChainSessions(classId: string, teacherId: mongoose.Types.ObjectId | string | null) {
  const rootId = await resolveClassRootId(classId, teacherId);
  if (!rootId) return { rootId: null, sessions: [] };

  const rootObjectId = new mongoose.Types.ObjectId(rootId);
  const sessions = await ClassroomSession.find({
    $or: [{ _id: rootObjectId }, { rootSessionId: rootObjectId }],
    ...(teacherId ? { teacherId } : {}),
  })
    .sort({ createdAt: 1 })
    .lean<Array<ClassroomSessionRecord & { _id: mongoose.Types.ObjectId }>>();

  return { rootId, sessions };
}

export async function loadClassDetail(
  classId: string,
  teacherId: mongoose.Types.ObjectId | string | null,
  now: Date = new Date(),
): Promise<ClassroomClassDetail | null> {
  const { sessions } = await findChainSessions(classId, teacherId);
  if (sessions.length === 0) return null;

  const [participants, accessCodes, gameData, quizzes] = await loadClassroomRecords(sessions);
  const [classroomClass] = groupSessionsIntoClasses(sessions, now);
  const summary = summarizeClassroomClass(classroomClass, { participants, accessCodes, gameData, quizzes });

  return {
    summary,
    roster: buildClassroomRoster(participants),
    sessionStates: classroomClass.sessions.map((session) => {
      const sessionId = toIdString(session._id) as string;
      return {
        sessionId,
        title: session.title,
        state: resolveClassroomSessionState(session, now),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        closedAt: session.closedAt ?? null,
        accessCodes: accessCodes
          .filter((accessCode) => toIdString(accessCode.sessionId) === sessionId)
          .map((accessCode) => ({
            code: accessCode.code,
            isActive: accessCode.isActive,
            createdAt: accessCode.createdAt,
            lastSeenAt: accessCode.lastSeenAt ?? null,
          })),
      };
    }),
    gameData,
    quizzes,
    activity: buildClassroomActivity({
      classTitle: classroomClass.title,
      participants,
      gameData,
      quizzes,
    }),
  };
}

/**
 * Reopens a class by appending a linked continuation session rather than rewriting the closed one.
 * Prior participants, game saves, and quiz results keep pointing at the sessions that produced
 * them; only new activity lands on the continuation.
 */
export async function reopenClassroomClass(input: {
  classId: string;
  teacherId: mongoose.Types.ObjectId | string;
  now?: Date;
}): Promise<ReopenClassroomResult> {
  const now = input.now ?? new Date();

  if (!mongoose.Types.ObjectId.isValid(input.classId)) {
    return { ok: false, reason: "invalid" };
  }

  const { rootId, sessions } = await findChainSessions(input.classId, input.teacherId);
  if (!rootId || sessions.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  const latestSession = sessions[sessions.length - 1];

  if (resolveClassroomSessionState(latestSession, now) === "active") {
    const activeCode = await StudentAccessCode.findOne({ sessionId: latestSession._id, isActive: true }).lean<{
      code: string;
    } | null>();

    return {
      ok: true,
      reopened: false,
      classId: rootId,
      sessionId: String(latestSession._id),
      accessCode: activeCode?.code ?? null,
      expiresAt: latestSession.expiresAt,
    };
  }

  const chainIds = sessions.map((session) => session._id);

  // Any other class this educator still has open must yield, matching how starting a new class behaves.
  await closeActiveClassroomSessions(input.teacherId, { exceptSessionIds: chainIds, now });

  // An expired session is still stored as "active"; close it against its own expiry so the history
  // timeline reports when it actually ended rather than when it was reopened.
  await Promise.all(
    sessions
      .filter((session) => session.status === "active")
      .map((session) =>
        ClassroomSession.updateOne(
          { _id: session._id },
          { $set: { status: "closed", closedAt: session.closedAt ?? session.expiresAt } },
        ),
      ),
  );

  // Retire every code the chain has ever issued, so a student holding an old one cannot rejoin.
  await StudentAccessCode.updateMany({ sessionId: { $in: chainIds }, isActive: true }, { $set: { isActive: false } });

  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const continuation = await ClassroomSession.create({
    teacherId: input.teacherId,
    title: latestSession.title,
    status: "active",
    createdAt: now,
    expiresAt,
    closedAt: null,
    continuedFromId: latestSession._id,
    rootSessionId: new mongoose.Types.ObjectId(rootId),
  });

  let accessCode: string;
  try {
    accessCode = await issueAccessCode(continuation._id);
  } catch (error) {
    // An active session with no code cannot be joined and cannot be reopened again, so roll the
    // continuation back and let the caller retry rather than stranding the class.
    await ClassroomSession.updateOne({ _id: continuation._id }, { $set: { status: "closed", closedAt: now } });
    throw error;
  }

  return {
    ok: true,
    reopened: true,
    classId: rootId,
    sessionId: String(continuation._id),
    accessCode,
    expiresAt,
  };
}
