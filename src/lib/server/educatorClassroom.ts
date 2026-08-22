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
  options: { exceptSessionIds?: Array<mongoose.Types.ObjectId | string>; now?: Date } = {},
) {
  const except = (options.exceptSessionIds ?? []).map((id) => String(id));
  const activeSessions = await ClassroomSession.find({ teacherId, status: "active" }).lean<
    Array<{ _id: mongoose.Types.ObjectId }>
  >();

  const closingIds = activeSessions.map((session) => session._id).filter((id) => !except.includes(String(id)));

  if (closingIds.length === 0) return [];

  await Promise.all([
    ClassroomSession.updateMany(
      { _id: { $in: closingIds } },
      { $set: { status: "closed", closedAt: options.now ?? new Date() } },
    ),
    StudentAccessCode.updateMany({ sessionId: { $in: closingIds }, isActive: true }, { $set: { isActive: false } }),
  ]);

  return closingIds;
}

/**
 * Read-only educator lookup for server-rendered pages. Unlike `getTeacherForCurrentUser` it never
 * creates a Teacher record, so simply viewing a page cannot mutate data.
 */
export async function findEducatorTeacher(userId: string) {
  const dbUser = await User.findOne({ clerkId: userId }).lean<{ name?: string; role?: string } | null>();
  if (dbUser?.role !== "educator") return null;

  const teacher = await Teacher.findOne({ clerkId: userId }).lean<{ _id: mongoose.Types.ObjectId } | null>();
  if (!teacher) return null;

  return { name: dbUser.name ?? "Educator", teacherId: teacher._id };
}
