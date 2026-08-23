import { createHash } from "node:crypto";
import {
  QuizScoreRecord,
  averagePercent,
  formatPercent,
  getPostQuizPercentages,
  getPreQuizPercentages,
  getQuizResultBreakdown,
} from "@/lib/quizScoring";

export type IdLike = string | { toString(): string };

export type ClassroomSessionState = "active" | "expired" | "closed";

export type ClassroomSessionRecord = {
  _id: IdLike;
  title: string;
  status: "active" | "closed";
  createdAt: Date;
  expiresAt: Date;
  closedAt?: Date | null;
  continuedFromId?: IdLike | null;
  rootSessionId?: IdLike | null;
};

export type ClassroomParticipantRecord = {
  _id: IdLike;
  sessionId: IdLike;
  participantKey: string;
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
};

export type ClassroomAccessCodeRecord = {
  _id: IdLike;
  sessionId: IdLike;
  code: string;
  isActive: boolean;
  createdAt: Date;
  lastSeenAt?: Date | null;
};

export type ClassroomGameRecord = {
  _id: IdLike;
  classroomSessionId?: string | null;
  classroomParticipantId?: string | null;
  gameId: string;
  lastUpdated: Date;
  studentDisplayName?: string | null;
  completedLevels?: number[];
  completedStageIds?: string[];
};

export type ClassroomQuizRecord = QuizScoreRecord & {
  _id: IdLike;
  classroomSessionId?: string | null;
  classroomParticipantId?: string | null;
  studentDisplayName?: string | null;
  completed?: boolean;
  updatedAt?: Date;
};

export type ClassroomClass = {
  classId: string;
  title: string;
  state: ClassroomSessionState;
  sessions: ClassroomSessionRecord[];
  latestSession: ClassroomSessionRecord;
  createdAt: Date;
  expiresAt: Date;
  closedAt: Date | null;
  reopenCount: number;
};

export type ClassroomRosterEntry = {
  participantKey: string;
  participantIds: string[];
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
  sessionIds: string[];
};

export type ClassroomActivityItem = {
  id: string;
  description: string;
  occurredAt: Date;
};

export type ClassroomClassSummary = ClassroomClass & {
  participantCount: number;
  gamesPlayed: number;
  quizzesRecorded: number;
  averagePreQuizScore: number | null;
  averagePostQuizScore: number | null;
  lastActivityAt: Date | null;
  activeAccessCode: string | null;
};

export function toIdString(value: IdLike | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const asString = typeof value === "string" ? value : String(value);
  return asString.length > 0 ? asString : null;
}

/**
 * A class is a continuation chain, not a single session. `rootSessionId` is null on the original
 * session, so the chain is always addressed by the id of the session that started it.
 */
export function getClassId(session: Pick<ClassroomSessionRecord, "_id" | "rootSessionId">) {
  return toIdString(session.rootSessionId) ?? (toIdString(session._id) as string);
}

export function resolveClassroomSessionState(
  session: Pick<ClassroomSessionRecord, "status" | "expiresAt">,
  now: Date = new Date(),
): ClassroomSessionState {
  if (session.status === "closed") return "closed";
  return session.expiresAt.getTime() <= now.getTime() ? "expired" : "active";
}

export function isClassroomSessionJoinable(
  session: Pick<ClassroomSessionRecord, "status" | "expiresAt">,
  now: Date = new Date(),
) {
  return resolveClassroomSessionState(session, now) === "active";
}

function compareByTime(a: Date, b: Date) {
  return a.getTime() - b.getTime();
}

export function groupSessionsIntoClasses(sessions: ClassroomSessionRecord[], now: Date = new Date()): ClassroomClass[] {
  const chains = new Map<string, ClassroomSessionRecord[]>();

  for (const session of sessions) {
    const classId = getClassId(session);
    const chain = chains.get(classId);
    if (chain) {
      chain.push(session);
    } else {
      chains.set(classId, [session]);
    }
  }

  return Array.from(chains.entries())
    .map(([classId, chain]) => {
      const ordered = [...chain].sort((a, b) => compareByTime(a.createdAt, b.createdAt));
      const latestSession = ordered[ordered.length - 1];

      return {
        classId,
        title: latestSession.title,
        state: resolveClassroomSessionState(latestSession, now),
        sessions: ordered,
        latestSession,
        createdAt: ordered[0].createdAt,
        expiresAt: latestSession.expiresAt,
        closedAt: latestSession.closedAt ?? null,
        reopenCount: ordered.length - 1,
      };
    })
    .sort((a, b) => compareByTime(b.latestSession.createdAt, a.latestSession.createdAt));
}

/**
 * Reopening a class creates a new session, so a returning student produces a second participant
 * row that shares the original `participantKey`. Collapsing on that key is what keeps a roster
 * continuous across reopens without mutating any historical record.
 */
export function buildClassroomRoster(participants: ClassroomParticipantRecord[]): ClassroomRosterEntry[] {
  const entries = new Map<string, ClassroomRosterEntry>();

  for (const participant of participants) {
    const participantId = toIdString(participant._id);
    const sessionId = toIdString(participant.sessionId);
    const existing = entries.get(participant.participantKey);

    if (!existing) {
      entries.set(participant.participantKey, {
        participantKey: participant.participantKey,
        participantIds: participantId ? [participantId] : [],
        displayName: participant.displayName,
        joinedAt: participant.joinedAt,
        lastSeenAt: participant.lastSeenAt,
        sessionIds: sessionId ? [sessionId] : [],
      });
      continue;
    }

    if (participantId && !existing.participantIds.includes(participantId)) {
      existing.participantIds.push(participantId);
    }
    if (sessionId && !existing.sessionIds.includes(sessionId)) {
      existing.sessionIds.push(sessionId);
    }
    if (compareByTime(participant.joinedAt, existing.joinedAt) < 0) {
      existing.joinedAt = participant.joinedAt;
    }
    if (compareByTime(participant.lastSeenAt, existing.lastSeenAt) >= 0) {
      existing.lastSeenAt = participant.lastSeenAt;
      existing.displayName = participant.displayName;
    }
  }

  return Array.from(entries.values()).sort((a, b) => compareByTime(a.joinedAt, b.joinedAt));
}

export function getGameLabel(gameId: string) {
  return gameId === "statesOfMatterGame" ? "States of Matter" : "Penguin Run";
}

export function buildClassroomActivity(input: {
  classTitle: string;
  participants: ClassroomParticipantRecord[];
  gameData: ClassroomGameRecord[];
  quizzes: ClassroomQuizRecord[];
}): ClassroomActivityItem[] {
  return [
    ...input.participants.map((participant) => ({
      id: `participant-${toIdString(participant._id)}`,
      description: `${participant.displayName} joined ${input.classTitle}.`,
      occurredAt: participant.joinedAt,
    })),
    ...input.gameData.map((game) => ({
      id: `game-${toIdString(game._id)}`,
      description: `${game.studentDisplayName || "A student"} played ${getGameLabel(game.gameId)}.`,
      occurredAt: game.lastUpdated,
    })),
    ...input.quizzes.flatMap((quiz) => {
      if (!quiz.updatedAt) return [];
      const updatedAt = quiz.updatedAt;

      return getQuizResultBreakdown(quiz).map((result) => ({
        id: `quiz-${toIdString(quiz._id)}-${result.key}`,
        description: `${quiz.studentDisplayName || "A student"} completed ${result.label} with ${formatPercent(result.score)}.`,
        occurredAt: updatedAt,
      }));
    }),
  ].sort((a, b) => compareByTime(b.occurredAt, a.occurredAt));
}

function getLastActivityAt(input: {
  participants: ClassroomParticipantRecord[];
  gameData: ClassroomGameRecord[];
  quizzes: ClassroomQuizRecord[];
}): Date | null {
  const timestamps = [
    ...input.participants.map((participant) => participant.lastSeenAt),
    ...input.gameData.map((game) => game.lastUpdated),
    ...input.quizzes.map((quiz) => quiz.updatedAt),
  ].filter((value): value is Date => value instanceof Date);

  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, value) => (compareByTime(value, latest) > 0 ? value : latest));
}

export function summarizeClassroomClass(
  classroomClass: ClassroomClass,
  input: {
    participants: ClassroomParticipantRecord[];
    accessCodes: ClassroomAccessCodeRecord[];
    gameData: ClassroomGameRecord[];
    quizzes: ClassroomQuizRecord[];
  },
): ClassroomClassSummary {
  const prePercentages = input.quizzes.flatMap(getPreQuizPercentages);
  const postPercentages = input.quizzes.flatMap(getPostQuizPercentages);
  const latestSessionId = toIdString(classroomClass.latestSession._id);
  const activeAccessCode = input.accessCodes.find(
    (accessCode) => accessCode.isActive && toIdString(accessCode.sessionId) === latestSessionId,
  );

  return {
    ...classroomClass,
    participantCount: buildClassroomRoster(input.participants).length,
    gamesPlayed: input.gameData.length,
    quizzesRecorded: input.quizzes.length,
    averagePreQuizScore: prePercentages.length ? averagePercent(prePercentages) : null,
    averagePostQuizScore: postPercentages.length ? averagePercent(postPercentages) : null,
    lastActivityAt: getLastActivityAt(input),
    // Only a class whose newest session is still live can hand out a working code.
    activeAccessCode: classroomClass.state === "active" && activeAccessCode ? activeAccessCode.code : null,
  };
}

/**
 * Buckets records that carry a `classroomSessionId` by the class their session belongs to, so a
 * single query per collection can serve a list of classes.
 */
export function bucketBySessionOwner<T extends { classroomSessionId?: string | null }>(
  records: T[],
  classIdBySessionId: Map<string, string>,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  for (const record of records) {
    const classId = record.classroomSessionId ? classIdBySessionId.get(record.classroomSessionId) : undefined;
    if (!classId) continue;

    const bucket = buckets.get(classId);
    if (bucket) {
      bucket.push(record);
    } else {
      buckets.set(classId, [record]);
    }
  }

  return buckets;
}

export function bucketByParticipantSession<T extends { sessionId: IdLike }>(
  records: T[],
  classIdBySessionId: Map<string, string>,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  for (const record of records) {
    const sessionId = toIdString(record.sessionId);
    const classId = sessionId ? classIdBySessionId.get(sessionId) : undefined;
    if (!classId) continue;

    const bucket = buckets.get(classId);
    if (bucket) {
      bucket.push(record);
    } else {
      buckets.set(classId, [record]);
    }
  }

  return buckets;
}

export function buildClassIdBySessionId(sessions: ClassroomSessionRecord[]) {
  const classIdBySessionId = new Map<string, string>();

  for (const session of sessions) {
    const sessionId = toIdString(session._id);
    if (sessionId) classIdBySessionId.set(sessionId, getClassId(session));
  }

  return classIdBySessionId;
}

/**
 * Serializable projections of classroom records.
 *
 * The stored documents carry identity and answer detail that history views never need — Clerk ids
 * (directly on a quiz, and embedded in a participant's `participantKey`), quiz/save ids, and every
 * per-question answer. These views are the only shape that should cross an API boundary.
 */
export type ClassroomRosterView = {
  id: string;
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
  sessionCount: number;
};

export type ClassroomGameView = {
  id: string;
  gameId: string;
  gameLabel: string;
  studentDisplayName: string | null;
  completedLevelCount: number;
  completedStageCount: number;
  lastUpdated: Date;
};

export type ClassroomQuizView = QuizScoreRecord & {
  id: string;
  studentDisplayName: string | null;
  completed: boolean;
  updatedAt: Date | null;
};

export function toClassroomRosterView(entry: ClassroomRosterEntry): ClassroomRosterView {
  return {
    // The participant id is stable within the class and carries no external identity, unlike the
    // participantKey it replaces. When there is no participant id the key is hashed rather than
    // emitted — a participantKey is `clerk:<userId>`, so passing it through would leak exactly the
    // identity this projection exists to withhold.
    id: entry.participantIds[0] ?? createHash("sha256").update(entry.participantKey).digest("hex").slice(0, 24),
    displayName: entry.displayName,
    joinedAt: entry.joinedAt,
    lastSeenAt: entry.lastSeenAt,
    sessionCount: entry.sessionIds.length,
  };
}

export function toClassroomGameView(game: ClassroomGameRecord): ClassroomGameView {
  return {
    id: toIdString(game._id) as string,
    gameId: game.gameId,
    gameLabel: getGameLabel(game.gameId),
    studentDisplayName: game.studentDisplayName ?? null,
    completedLevelCount: game.completedLevels?.length ?? 0,
    completedStageCount: game.completedStageIds?.length ?? 0,
    lastUpdated: game.lastUpdated,
  };
}

export function toClassroomQuizView(quiz: ClassroomQuizRecord): ClassroomQuizView {
  return {
    id: toIdString(quiz._id) as string,
    studentDisplayName: quiz.studentDisplayName ?? null,
    completed: Boolean(quiz.completed),
    updatedAt: quiz.updatedAt ?? null,
    statesOfMatterScoreBefore: quiz.statesOfMatterScoreBefore,
    stateOfMatterScoreAfter: quiz.stateOfMatterScoreAfter,
    penguinRunScoreBefore: quiz.penguinRunScoreBefore,
    penguinRunScoreAfter: quiz.penguinRunScoreAfter,
  };
}
