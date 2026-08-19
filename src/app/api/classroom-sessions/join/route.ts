import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import connectDB from "@/database/db";
import ClassroomSession from "@/database/classroomSessionSchema";
import StudentAccessCode from "@/database/studentAccessCodeSchema";
import ClassroomParticipant from "@/database/classroomParticipantSchema";
import User from "@/database/userSchema";
import {
  createClassroomCredential,
  hashClassroomSecret,
  setClassroomCredentialCookie,
} from "@/lib/server/classroomAuthorization";

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    await connectDB();

    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown;
      displayName?: unknown;
      guestToken?: unknown;
    };

    const code = typeof body.code === "string" ? normalizeCode(body.code) : "";
    const guestToken = typeof body.guestToken === "string" ? body.guestToken.trim() : "";
    const submittedName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "An access code is required." }, { status: 400 });
    }

    const accessCode = await StudentAccessCode.findOne({ code, isActive: true }).lean<{
      _id: mongoose.Types.ObjectId;
      sessionId: mongoose.Types.ObjectId;
    } | null>();

    if (!accessCode) {
      return NextResponse.json({ error: "That access code is not active." }, { status: 404 });
    }

    const session = await ClassroomSession.findOne({
      _id: accessCode.sessionId,
      status: "active",
      expiresAt: { $gt: new Date() },
    }).lean<{
      _id: mongoose.Types.ObjectId;
      title: string;
      expiresAt: Date;
    } | null>();

    if (!session) {
      return NextResponse.json({ error: "That classroom session has ended." }, { status: 410 });
    }

    const user = userId
      ? await User.findOne({ clerkId: userId }).lean<{
          name?: string;
          username?: string;
        } | null>()
      : null;

    const displayName = submittedName || user?.name?.trim() || user?.username?.trim() || "";

    if (!displayName) {
      return NextResponse.json({ error: "A student name is required." }, { status: 400 });
    }

    const participantKey = userId ? `clerk:${userId}` : guestToken ? `guest:${hashClassroomSecret(guestToken)}` : "";

    if (!participantKey) {
      return NextResponse.json({ error: "Unable to create a student session." }, { status: 400 });
    }

    const credentialParticipantId = new mongoose.Types.ObjectId();
    const participant = await ClassroomParticipant.findOneAndUpdate(
      { sessionId: session._id, participantKey },
      {
        $set: {
          accessCodeId: accessCode._id,
          clerkId: userId ?? null,
          displayName,
          lastSeenAt: new Date(),
        },
        $setOnInsert: {
          _id: credentialParticipantId,
          joinedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean<{
      _id: mongoose.Types.ObjectId;
      displayName: string;
      joinedAt: Date;
      lastSeenAt: Date;
    } | null>();

    if (!participant) {
      return NextResponse.json({ error: "Unable to create a student session." }, { status: 500 });
    }

    const participantCredential = createClassroomCredential(String(participant._id));
    await ClassroomParticipant.updateOne(
      { _id: participant._id },
      { $set: { authTokenHash: participantCredential.tokenHash } },
    );

    await StudentAccessCode.findByIdAndUpdate(accessCode._id, { $set: { lastSeenAt: new Date() } });

    const response = NextResponse.json(
      {
        sessionId: String(session._id),
        expiresAt: session.expiresAt.toISOString(),
        title: session.title,
        participant: {
          id: String(participant._id),
          displayName: participant.displayName,
          joinedAt: participant.joinedAt,
          lastSeenAt: participant.lastSeenAt,
        },
      },
      { status: 200 },
    );
    setClassroomCredentialCookie(response, participantCredential.cookieValue, session.expiresAt);
    return response;
  } catch (error: any) {
    console.error("POST /api/classroom-sessions/join error:", error);
    return NextResponse.json({ error: "Failed to join classroom session." }, { status: 500 });
  }
}
