import mongoose from "mongoose";
import { NextResponse } from "next/server";
import ClassroomSession from "@/database/classroomSessionSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import Teacher from "@/database/teacherSchema";
import User from "@/database/userSchema";

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const ACCESS_CODE_ATTEMPTS = 5;

export type EducatorLookup = { teacherId: mongoose.Types.ObjectId } | { error: NextResponse };

export function generateAccessCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join("");

  return `${pick(letters, 6)}-${pick(alphanumeric, 3)}`;
}

export async function getTeacherForCurrentUser(userId: string): Promise<EducatorLookup> {
  const dbUser = await User.findOne({ clerkId: userId }).lean<{
    name?: string;
    email?: string;
    role?: string;
  } | null>();

  if (dbUser?.role !== "educator") {
    return { error: NextResponse.json({ error: "Educator access required." }, { status: 403 }) };
  }

  const teacher = await Teacher.findOneAndUpdate(
    { clerkId: userId },
    {
      $set: {
        name: dbUser.name ?? "Educator",
        email: dbUser.email ?? `${userId}@example.invalid`,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean<{ _id: mongoose.Types.ObjectId } | null>();

  if (!teacher) {
    return { error: NextResponse.json({ error: "Unable to create educator profile." }, { status: 500 }) };
  }

  return { teacherId: teacher._id };
}

/**
 * Mints a fresh access code for a session. The unique partial index on active codes means a
 * collision is possible but rare, so retry a bounded number of times before surfacing the error.
 */
export async function issueAccessCode(sessionId: mongoose.Types.ObjectId | string) {
  for (let attempt = 0; attempt < ACCESS_CODE_ATTEMPTS; attempt += 1) {
    const code = generateAccessCode();
    try {
      await StudentAccessCode.create({ sessionId, code });
      return code;
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === ACCESS_CODE_ATTEMPTS - 1) throw error;
    }
  }

  throw new Error("Unable to generate a unique access code.");
}

/**
 * Closes every active session for a teacher and deactivates its codes, so only one class of theirs
 * can accept joins at a time. Sessions listed in `exceptSessionIds` are left untouched.
 */
export async function closeActiveClassroomSessions(
  teacherId: mongoose.Types.ObjectId | string,
  options: {
    exceptSessionIds?: Array<mongoose.Types.ObjectId | string>;
    exceptChainRootId?: mongoose.Types.ObjectId | string;
    now?: Date;
  } = {},
) {
  const except = (options.exceptSessionIds ?? []).map((id) => String(id));

  // Excluding a whole chain has to happen in the query, not against a list of ids read earlier. A
  // concurrent reopen can add a session to the chain in between, and a stale list would treat that
  // brand new continuation as an unrelated class and close it.
  const rootId = options.exceptChainRootId ? new mongoose.Types.ObjectId(String(options.exceptChainRootId)) : null;
  const chainFilter = rootId ? { $nor: [{ _id: rootId }, { rootSessionId: rootId }] } : {};

  const activeSessions = await ClassroomSession.find({ teacherId, status: "active", ...chainFilter }).lean<
    Array<{ _id: mongoose.Types.ObjectId }>
  >();

  const closingIds = activeSessions.map((session) => session._id).filter((id) => !except.includes(String(id)));

  if (closingIds.length === 0) return [];

  const closedAt = options.now ?? new Date();

  await Promise.all([
    // An expired session is still stored as "active", so stamp it with when it actually ended
    // rather than when something else happened to close it. Matches how a reopen closes its own
    // chain, and keeps the history timeline honest.
    ClassroomSession.updateMany({ _id: { $in: closingIds } }, [
      {
        $set: {
          status: "closed",
          closedAt: {
            $ifNull: ["$closedAt", { $cond: [{ $lte: ["$expiresAt", closedAt] }, "$expiresAt", closedAt] }],
          },
        },
      },
    ]),
    StudentAccessCode.updateMany({ sessionId: { $in: closingIds }, isActive: true }, { $set: { isActive: false } }),
  ]);

  return closingIds;
}

/**
 * Read-only educator lookup for server-rendered pages. Unlike `getTeacherForCurrentUser` it never
 * creates a Teacher record, so simply viewing a page cannot mutate data.
 *
 * Returns null only when the user is not an educator. The Teacher record is created lazily on first
 * class creation, so `teacherId` is null for an educator who has signed up but never run a class —
 * that is someone with no classes, not someone without access.
 */
export async function findEducatorTeacher(userId: string) {
  const dbUser = await User.findOne({ clerkId: userId }).lean<{ name?: string; role?: string } | null>();
  if (dbUser?.role !== "educator") return null;

  const teacher = await Teacher.findOne({ clerkId: userId }).lean<{ _id: mongoose.Types.ObjectId } | null>();

  return { name: dbUser.name ?? "Educator", teacherId: teacher?._id ?? null };
}
