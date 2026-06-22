import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import connectDB from "@/database/db";
import ClassroomSession from "@/database/classroomSessionSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import Teacher from "@/database/teacherSchema";
import User from "@/database/userSchema";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function generateAccessCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join("");

  return `${pick(letters, 6)}-${pick(alphanumeric, 3)}`;
}

async function buildSessionPayload(sessionId: mongoose.Types.ObjectId | string) {
  const [session, accessCode, participants] = await Promise.all([
    ClassroomSession.findById(sessionId).lean<{
      _id: mongoose.Types.ObjectId;
      title: string;
      status: "active" | "closed";
      createdAt: Date;
      expiresAt: Date;
      closedAt: Date | null;
    } | null>(),
    StudentAccessCode.findOne({ sessionId, isActive: true }).lean<{
      _id: mongoose.Types.ObjectId;
      code: string;
      lastSeenAt: Date | null;
    } | null>(),
    ClassroomParticipant.find({ sessionId }).sort({ joinedAt: 1 }).lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        displayName: string;
        joinedAt: Date;
        lastSeenAt: Date;
      }>
    >(),
  ]);

  if (!session || !accessCode) return null;

  return {
    sessionId: String(session._id),
    title: session.title,
    status: session.status,
    accessCode: accessCode.code,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    closedAt: session.closedAt,
    participants: participants.map((participant) => ({
      id: String(participant._id),
      displayName: participant.displayName,
      joinedAt: participant.joinedAt,
      lastSeenAt: participant.lastSeenAt,
    })),
  };
}

async function getTeacherForCurrentUser(userId: string) {
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
  ).lean<{ _id: mongoose.Types.ObjectId }>();

  return { teacherId: teacher._id };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const teacherResult = await getTeacherForCurrentUser(userId);
    if ("error" in teacherResult) return teacherResult.error;

    const activeSession = await ClassroomSession.findOne({
      teacherId: teacherResult.teacherId,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!activeSession) {
      return NextResponse.json({ session: null }, { status: 200 });
    }

    const session = await buildSessionPayload(activeSession._id);
    return NextResponse.json({ session }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/classroom-sessions error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load classroom session." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const teacherResult = await getTeacherForCurrentUser(userId);
    if ("error" in teacherResult) return teacherResult.error;

    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
    const title = requestedTitle || "Untitled Class";

    const existingActiveSessions = await ClassroomSession.find({
      teacherId: teacherResult.teacherId,
      status: "active",
    }).lean<Array<{ _id: mongoose.Types.ObjectId }>>();

    if (existingActiveSessions.length > 0) {
      const existingIds = existingActiveSessions.map((session) => session._id);
      await Promise.all([
        ClassroomSession.updateMany(
          { _id: { $in: existingIds } },
          { $set: { status: "closed", closedAt: new Date() } },
        ),
        StudentAccessCode.updateMany(
          { sessionId: { $in: existingIds }, isActive: true },
          { $set: { isActive: false } },
        ),
      ]);
    }

    const session = await ClassroomSession.create({
      teacherId: teacherResult.teacherId,
      title,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    });

    let accessCode = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        accessCode = generateAccessCode();
        await StudentAccessCode.create({
          sessionId: session._id,
          code: accessCode,
        });
        break;
      } catch (error: any) {
        if (error?.code !== 11000 || attempt === 4) throw error;
      }
    }

    const payload = await buildSessionPayload(session._id);
    return NextResponse.json({ session: payload }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/classroom-sessions error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create classroom session." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const teacherResult = await getTeacherForCurrentUser(userId);
    if ("error" in teacherResult) return teacherResult.error;

    const body = (await request.json().catch(() => ({}))) as { title?: unknown };
    const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";

    if (!requestedTitle) {
      return NextResponse.json({ error: "A class name is required." }, { status: 400 });
    }

    const session = await ClassroomSession.findOneAndUpdate(
      {
        teacherId: teacherResult.teacherId,
        status: "active",
        expiresAt: { $gt: new Date() },
      },
      { $set: { title: requestedTitle } },
      { new: true },
    ).lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (!session) {
      return NextResponse.json({ error: "No active classroom session found." }, { status: 404 });
    }

    const payload = await buildSessionPayload(session._id);
    return NextResponse.json({ session: payload }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/classroom-sessions error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to update classroom session." }, { status: 500 });
  }
}
