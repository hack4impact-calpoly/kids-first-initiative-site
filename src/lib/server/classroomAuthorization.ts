import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import ClassroomSession from "@/database/classroomSessionSchema";
import Teacher from "@/database/teacherSchema";
import User from "@/database/userSchema";
import {
  AuthorizationResult,
  RequestActor,
  forbidden,
  requireSignedIn,
  unauthorized,
} from "@/lib/server/apiAuthorization";

export const CLASSROOM_ACCESS_COOKIE = "kfi_classroom_access";

type ClassroomParticipantRecord = {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  clerkId?: string | null;
  displayName: string;
};

export type AuthorizedClassroomParticipant = {
  participantId: string;
  sessionId: string;
  displayName: string;
  clerkId: string | null;
};

export type DataPrincipal = {
  ownerId: string;
  actor: RequestActor;
  classroom: AuthorizedClassroomParticipant | null;
};

type ParsedClassroomCredential = {
  participantId: string;
  tokenHash: string;
};

export function hashClassroomSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function createClassroomCredential(participantId: string) {
  const secret = randomBytes(32).toString("base64url");
  return {
    cookieValue: `${participantId}.${secret}`,
    tokenHash: hashClassroomSecret(secret),
  };
}

export function parseClassroomCredential(value: string | undefined) {
  if (!value) return null;

  const separatorIndex = value.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;

  const participantId = value.slice(0, separatorIndex);
  const secret = value.slice(separatorIndex + 1);
  if (!mongoose.Types.ObjectId.isValid(participantId) || secret.length < 32) return null;

  return { participantId, tokenHash: hashClassroomSecret(secret) };
}

export function setClassroomCredentialCookie(response: NextResponse, cookieValue: string, expiresAt: Date) {
  response.cookies.set({
    name: CLASSROOM_ACCESS_COOKIE,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function findActiveParticipant(filter: Record<string, unknown>) {
  const participant = await ClassroomParticipant.findOne(filter).lean<ClassroomParticipantRecord | null>();
  if (!participant) return null;

  const activeSession = await ClassroomSession.exists({
    _id: participant.sessionId,
    status: "active",
    expiresAt: { $gt: new Date() },
  });

  return activeSession ? participant : null;
}

export async function authorizeClassroomParticipant(
  request: NextRequest,
  actor: RequestActor,
  claimedParticipantId?: string,
): Promise<AuthorizationResult<AuthorizedClassroomParticipant>> {
  return authorizeClassroomParticipantWithCredential(
    parseClassroomCredential(request.cookies.get(CLASSROOM_ACCESS_COOKIE)?.value),
    actor,
    claimedParticipantId,
  );
}

async function authorizeClassroomParticipantWithCredential(
  credential: ParsedClassroomCredential | null,
  actor: RequestActor,
  claimedParticipantId?: string,
): Promise<AuthorizationResult<AuthorizedClassroomParticipant>> {
  let participant: ClassroomParticipantRecord | null = null;

  if (actor.userId) {
    const participantId = claimedParticipantId ?? credential?.participantId;
    if (!participantId || !mongoose.Types.ObjectId.isValid(participantId)) {
      return { ok: false, response: forbidden("Invalid classroom participant") };
    }

    participant = await findActiveParticipant({
      _id: participantId,
      clerkId: actor.userId,
      ...(claimedParticipantId ? {} : { authTokenHash: credential?.tokenHash }),
    });
    if (!participant) {
      return { ok: false, response: forbidden("Invalid classroom participant") };
    }
  } else {
    if (!credential) {
      return { ok: false, response: unauthorized("A valid classroom session is required") };
    }
    if (claimedParticipantId && claimedParticipantId !== credential.participantId) {
      return { ok: false, response: forbidden("Invalid classroom participant") };
    }

    participant = await findActiveParticipant({
      _id: credential.participantId,
      authTokenHash: credential.tokenHash,
      clerkId: null,
    });
    if (!participant) {
      return { ok: false, response: unauthorized("A valid classroom session is required") };
    }
  }

  return {
    ok: true,
    value: {
      participantId: String(participant._id),
      sessionId: String(participant.sessionId),
      displayName: participant.displayName,
      clerkId: participant.clerkId ?? null,
    },
  };
}

export async function resolveDataPrincipalFromCredential(
  credentialValue: string | undefined,
  actor: RequestActor,
  claimedParticipantId?: string,
): Promise<AuthorizationResult<DataPrincipal>> {
  const credential = parseClassroomCredential(credentialValue);
  const hasClassroomCredential = Boolean(credential);

  if (claimedParticipantId || !actor.userId || hasClassroomCredential) {
    const classroomResult = await authorizeClassroomParticipantWithCredential(credential, actor, claimedParticipantId);
    if (!classroomResult.ok) {
      if (claimedParticipantId || !actor.userId) return classroomResult;
    } else {
      return {
        ok: true,
        value: {
          ownerId: `participant:${classroomResult.value.participantId}`,
          actor,
          classroom: classroomResult.value,
        },
      };
    }
  }

  return {
    ok: true,
    value: {
      ownerId: actor.userId,
      actor,
      classroom: null,
    },
  };
}

export async function resolveDataPrincipal(
  request: NextRequest,
  actor: RequestActor,
  claimedParticipantId?: string,
): Promise<AuthorizationResult<DataPrincipal>> {
  return resolveDataPrincipalFromCredential(
    request.cookies.get(CLASSROOM_ACCESS_COOKIE)?.value,
    actor,
    claimedParticipantId,
  );
}

/**
 * Every owner key a student's records may sit under within one class.
 *
 * Reopening a class appends a continuation session, and a returning student joins it as a *new*
 * participant row — same `participantKey`, new `_id`. Records are owned by `participant:<_id>`, so
 * without this a student who returns after a reopen cannot reach anything they did before it.
 *
 * Scoped two ways so it cannot widen access: only rows sharing the authorized participant's exact
 * `participantKey`, and only within the same continuation chain. The authorized participant's own
 * key is always first, so callers that want "most current" can take the head.
 */
export async function resolveClassroomOwnerKeys(participant: AuthorizedClassroomParticipant): Promise<string[]> {
  const current = `participant:${participant.participantId}`;

  if (!mongoose.Types.ObjectId.isValid(participant.sessionId)) return [current];

  const session = await ClassroomSession.findOne({ _id: participant.sessionId })
    .select("rootSessionId")
    .lean<{ _id: mongoose.Types.ObjectId; rootSessionId?: mongoose.Types.ObjectId | null } | null>();
  if (!session) return [current];

  const rootId = session.rootSessionId ?? session._id;
  const chainSessionIds = await ClassroomSession.find({
    $or: [{ _id: rootId }, { rootSessionId: rootId }],
  })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  if (chainSessionIds.length <= 1) return [current];

  const self = await ClassroomParticipant.findOne({ _id: participant.participantId })
    .select("participantKey")
    .lean<{ participantKey: string } | null>();
  if (!self?.participantKey) return [current];

  const siblings = await ClassroomParticipant.find({
    sessionId: { $in: chainSessionIds.map((entry) => entry._id) },
    participantKey: self.participantKey,
  })
    .select("_id")
    .sort({ joinedAt: -1 })
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  const keys = siblings.map((entry) => `participant:${String(entry._id)}`);
  return [current, ...keys.filter((key) => key !== current)];
}

export async function canEducatorReadClassroom(actor: RequestActor, classroomSessionId: string | null | undefined) {
  if (!actor.userId || !classroomSessionId || !mongoose.Types.ObjectId.isValid(classroomSessionId)) return false;
  if (actor.role === "admin") return true;

  const signedIn = requireSignedIn(actor);
  if (!signedIn.ok) return false;

  const dbUser = await User.exists({ clerkId: signedIn.value.userId, role: "educator" });
  if (!dbUser) return false;

  const teacher = await Teacher.findOne({ clerkId: signedIn.value.userId }).lean<{
    _id: mongoose.Types.ObjectId;
  } | null>();
  if (!teacher) return false;

  return Boolean(await ClassroomSession.exists({ _id: classroomSessionId, teacherId: teacher._id }));
}
