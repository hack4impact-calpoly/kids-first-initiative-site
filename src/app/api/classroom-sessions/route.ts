import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import connectDB from "@/database/db";
import ClassroomSession from "@/database/classroomSessionSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import { getClassId } from "@/lib/server/classroomHistory";
import {
  SESSION_DURATION_MS,
  closeActiveClassroomSessions,
  getTeacherForCurrentUser,
  issueAccessCode,
} from "@/lib/server/educatorClassroom";

async function buildSessionPayload(sessionId: mongoose.Types.ObjectId | string) {
  const [session, accessCode, participants] = await Promise.all([
    ClassroomSession.findById(sessionId).lean<{
      _id: mongoose.Types.ObjectId;
      title: string;
      status: "active" | "closed";
      createdAt: Date;
      expiresAt: Date;
      closedAt: Date | null;
      rootSessionId?: mongoose.Types.ObjectId | null;
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
    classId: getClassId(session),
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
    return NextResponse.json({ error: "Failed to load classroom session." }, { status: 500 });
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

    await closeActiveClassroomSessions(teacherResult.teacherId);

    const session = await ClassroomSession.create({
      teacherId: teacherResult.teacherId,
      title,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    });

    await issueAccessCode(session._id);

    const payload = await buildSessionPayload(session._id);
    return NextResponse.json({ session: payload }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/classroom-sessions error:", error);
    return NextResponse.json({ error: "Failed to create classroom session." }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to update classroom session." }, { status: 500 });
  }
}
