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
  ClassroomGameView,
  ClassroomQuizView,
  ClassroomRosterView,
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
  toClassroomGameView,
  toClassroomQuizView,
  toClassroomRosterView,
  toIdString,
} from "@/lib/server/classroomHistory";
import { SESSION_DURATION_MS, closeActiveClassroomSessions, issueAccessCode } from "@/lib/server/educatorClassroom";

/**
 * The summary as it crosses an API boundary. `ClassroomClassSummary` spreads the class it was built
 * from, which carries the chain's session documents — including `teacherId`, and on the admin path
 * that means another educator's. `sessionStates` already describes every session, so the raw rows
 * are replaced by a count.
 */
export type ClassroomClassSummaryView = Omit<ClassroomClassSummary, "sessions" | "latestSession"> & {
  sessionCount: number;
};

export function toClassroomClassSummaryView(summary: ClassroomClassSummary): ClassroomClassSummaryView {
  const { sessions, latestSession: _latestSession, ...rest } = summary;
  return { ...rest, sessionCount: sessions.length };
}

export type ClassroomClassDetail = {
  summary: ClassroomClassSummaryView;
  roster: ClassroomRosterView[];
  sessionStates: Array<{
    sessionId: string;
    title: string;
    state: ClassroomSessionState;
    createdAt: Date;
    expiresAt: Date;
    closedAt: Date | null;
    accessCodes: Array<{ code: string; isActive: boolean; createdAt: Date; lastSeenAt: Date | null }>;
  }>;
  gameData: ClassroomGameView[];
  quizzes: ClassroomQuizView[];
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

  // Every projection below is a whitelist. Quiz documents carry `clerkId`, `quizId`, and full
  // per-question answers, and GameData carries `userId`/`saveId`; none of that belongs in a history
  // view, so it is never read rather than being stripped later.
  return Promise.all([
    ClassroomParticipant.find({ sessionId: { $in: objectIds } })
      .select("sessionId participantKey displayName joinedAt lastSeenAt")
      .sort({ joinedAt: 1 })
      .lean<ClassroomParticipantRecord[]>(),
    StudentAccessCode.find({ sessionId: { $in: objectIds } })
      .select("sessionId code isActive createdAt lastSeenAt")
      .sort({ createdAt: 1 })
      .lean<ClassroomAccessCodeRecord[]>(),
    GameData.find({ classroomSessionId: { $in: sessionIds } })
      .select(
        "classroomSessionId classroomParticipantId gameId lastUpdated studentDisplayName completedLevels completedStageIds",
      )
      .sort({ lastUpdated: -1 })
      .lean<ClassroomGameRecord[]>(),
    Quiz.find({ classroomSessionId: { $in: sessionIds } })
      .select(
        "classroomSessionId classroomParticipantId studentDisplayName completed updatedAt statesOfMatterScoreBefore stateOfMatterScoreAfter penguinRunScoreBefore penguinRunScoreAfter",
      )
      .sort({ updatedAt: -1 })
      .lean<ClassroomQuizRecord[]>(),
  ]);
}

export const DEFAULT_CLASS_PAGE_SIZE = 25;
export const MAX_CLASS_PAGE_SIZE = 200;

/** Shared by the page and the API route so the two cannot drift apart. */
export function parseClassPageLimit(value: string | null | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CLASS_PAGE_SIZE;
  return Math.min(parsed, MAX_CLASS_PAGE_SIZE);
}

/**
 * Summaries for an educator's most recent classes.
 *
 * Metrics are computed in JS, so the record fan-out is bounded by trimming to a page of classes
 * *before* their participants, codes, saves, and quizzes are read. Without that, an educator with a
 * term of history would pull every row they have ever produced on each page view.
 */
export type TeacherClassSummaryPage = {
  classes: ClassroomClassSummary[];
  total: number;
  hasMore: boolean;
};

export async function loadTeacherClassSummaries(
  teacherId: mongoose.Types.ObjectId | string,
  now: Date = new Date(),
  limit: number = DEFAULT_CLASS_PAGE_SIZE,
): Promise<TeacherClassSummaryPage> {
  const allSessions = await ClassroomSession.find({ teacherId })
    .select("title status createdAt expiresAt closedAt continuedFromId rootSessionId")
    .sort({ createdAt: 1 })
    .lean<Array<ClassroomSessionRecord & { _id: mongoose.Types.ObjectId }>>();

  if (allSessions.length === 0) return { classes: [], total: 0, hasMore: false };

  const allClasses = groupSessionsIntoClasses(allSessions, now);
  const pagedClasses = allClasses.slice(0, limit);
  const pagedClassIds = new Set(pagedClasses.map((classroomClass) => classroomClass.classId));
  const sessions = allSessions.filter((session) => pagedClassIds.has(getClassId(session)));

  const [participants, accessCodes, gameData, quizzes] = await loadClassroomRecords(sessions);
  const classIdBySessionId = buildClassIdBySessionId(sessions);
  const participantsByClass = bucketByParticipantSession(participants, classIdBySessionId);
  const accessCodesByClass = bucketByParticipantSession(accessCodes, classIdBySessionId);
  const gameDataByClass = bucketBySessionOwner(gameData, classIdBySessionId);
  const quizzesByClass = bucketBySessionOwner(quizzes, classIdBySessionId);

  return {
    classes: pagedClasses.map((classroomClass) =>
      summarizeClassroomClass(classroomClass, {
        participants: participantsByClass.get(classroomClass.classId) ?? [],
        accessCodes: accessCodesByClass.get(classroomClass.classId) ?? [],
        gameData: gameDataByClass.get(classroomClass.classId) ?? [],
        quizzes: quizzesByClass.get(classroomClass.classId) ?? [],
      }),
    ),
    total: allClasses.length,
    hasMore: allClasses.length > pagedClasses.length,
  };
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
    .select("title status createdAt expiresAt closedAt continuedFromId rootSessionId")
    .sort({ createdAt: 1 })
    .lean<Array<ClassroomSessionRecord & { _id: mongoose.Types.ObjectId }>>();

  return { rootId, sessions };
}

export const DEFAULT_ACTIVITY_LIMIT = 12;

export async function loadClassDetail(
  classId: string,
  teacherId: mongoose.Types.ObjectId | string | null,
  now: Date = new Date(),
  activityLimit: number = DEFAULT_ACTIVITY_LIMIT,
): Promise<ClassroomClassDetail | null> {
  const { sessions } = await findChainSessions(classId, teacherId);
  if (sessions.length === 0) return null;

  const [participants, accessCodes, gameData, quizzes] = await loadClassroomRecords(sessions);
  const [classroomClass] = groupSessionsIntoClasses(sessions, now);
  const summary = summarizeClassroomClass(classroomClass, { participants, accessCodes, gameData, quizzes });

  return {
    summary: toClassroomClassSummaryView(summary),
    roster: buildClassroomRoster(participants).map(toClassroomRosterView),
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
    gameData: gameData.map(toClassroomGameView),
    quizzes: quizzes.map(toClassroomQuizView),
    // The feed is derived from roster, game, and quiz rows that are already in this response, so
    // serializing all of it would send the same data twice. Only the slice that gets rendered.
    activity: buildClassroomActivity({
      classTitle: classroomClass.title,
      participants,
      gameData,
      quizzes,
    }).slice(0, activityLimit),
  };
}

/**
 * Describes a chain that is already live, for callers that must not reopen it again — the caller
 * that found it active, and the loser of a concurrent reopen race.
 */
async function describeActiveChain(
  rootId: string,
  teacherId: mongoose.Types.ObjectId | string,
  now: Date,
  knownSession?: ClassroomSessionRecord & { _id: mongoose.Types.ObjectId },
): Promise<ReopenClassroomResult> {
  const activeSession =
    knownSession ??
    (await ClassroomSession.findOne({
      rootSessionId: new mongoose.Types.ObjectId(rootId),
      teacherId,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .lean<(ClassroomSessionRecord & { _id: mongoose.Types.ObjectId }) | null>());

  if (!activeSession) return { ok: false, reason: "not_found" };

  const activeCode = await StudentAccessCode.findOne({ sessionId: activeSession._id, isActive: true }).lean<{
    code: string;
  } | null>();

  return {
    ok: true,
    reopened: false,
    classId: rootId,
    sessionId: String(activeSession._id),
    accessCode: activeCode?.code ?? null,
    expiresAt: activeSession.expiresAt,
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
    return describeActiveChain(rootId, input.teacherId, now, latestSession);
  }

  const chainIds = sessions.map((session) => session._id);

  // Order matters. Everything below up to the continuation touches only this class, which is
  // already closed or expired, so a failure leaves nothing worse off. Closing the educator's *other*
  // live class is destructive to its students, so it is deferred until this reopen has actually
  // succeeded.

  // An expired session is still stored as "active"; close it against its own expiry so the history
  // timeline reports when it actually ended rather than when it was reopened. This also frees the
  // chain's slot in the unique partial index before the continuation is inserted.
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

  let continuation: { _id: mongoose.Types.ObjectId };
  try {
    continuation = await ClassroomSession.create({
      teacherId: input.teacherId,
      title: latestSession.title,
      status: "active",
      createdAt: now,
      expiresAt,
      closedAt: null,
      continuedFromId: latestSession._id,
      rootSessionId: new mongoose.Types.ObjectId(rootId),
    });
  } catch (error: any) {
    // A unique partial index allows only one active continuation per chain. Losing that race means
    // a concurrent reopen already succeeded, so report its result instead of creating a second live
    // session with a second working code.
    if (error?.code !== 11000) throw error;
    return describeActiveChain(rootId, input.teacherId, now);
  }

  let accessCode: string;
  try {
    accessCode = await issueAccessCode(continuation._id);
  } catch (error) {
    // Delete rather than close. A closed phantom would stay in the chain as its newest session,
    // taking over the class's title, expiry, and reopen count, and showing up in the timeline as a
    // continuation that never existed for anyone. Nothing references it yet.
    await ClassroomSession.deleteOne({ _id: continuation._id });
    throw error;
  }

  // The reopen has succeeded, so it is now safe to make the educator's other class yield, matching
  // how starting a new class behaves. Excluded by chain rather than by the ids read above, so a
  // continuation created by a concurrent reopen is never mistaken for an unrelated class.
  await closeActiveClassroomSessions(input.teacherId, { exceptChainRootId: rootId, now });

  return {
    ok: true,
    reopened: true,
    classId: rootId,
    sessionId: String(continuation._id),
    accessCode,
    expiresAt,
  };
}
