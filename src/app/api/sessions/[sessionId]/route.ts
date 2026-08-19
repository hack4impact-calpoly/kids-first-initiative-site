import connectDB from "@/database/db";
import Session from "@/database/sessionSchema";
import { getRequestActor, isPlainObject, requireSignedIn } from "@/lib/server/apiAuthorization";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

async function getAuthorizedSession(sessionId: string) {
  const signedIn = requireSignedIn(await getRequestActor());
  if (!signedIn.ok) return signedIn;

  const session = await Session.findById(sessionId);
  if (!session || (signedIn.value.role !== "admin" && session.anonUserId !== signedIn.value.userId)) {
    return { ok: false as const, response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }

  return { ok: true as const, value: session };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    await connectDB();
    const authorized = await getAuthorizedSession(sessionId);
    if (!authorized.ok) return authorized.response;
    return NextResponse.json(authorized.value);
  } catch (error) {
    console.error("GET /api/sessions/:sessionId error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const rawBody: unknown = await request.json().catch(() => ({}));
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    await connectDB();
    const authorized = await getAuthorizedSession(sessionId);
    if (!authorized.ok) return authorized.response;

    const update: { endedAt?: Date; durationMs?: number } = {};
    if (rawBody.endedAt !== undefined) {
      if (typeof rawBody.endedAt !== "string" || Number.isNaN(Date.parse(rawBody.endedAt))) {
        return NextResponse.json({ error: "endedAt must be a valid date string" }, { status: 400 });
      }
      update.endedAt = new Date(rawBody.endedAt);
    } else if (Object.keys(rawBody).length === 0 || rawBody.endSession === true) {
      update.endedAt = new Date();
      update.durationMs = update.endedAt.getTime() - authorized.value.startedAt.getTime();
    }

    if (rawBody.durationMs !== undefined) {
      if (typeof rawBody.durationMs !== "number" || !Number.isFinite(rawBody.durationMs) || rawBody.durationMs < 0) {
        return NextResponse.json({ error: "durationMs must be a non-negative number" }, { status: 400 });
      }
      update.durationMs = rawBody.durationMs;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      { $set: update },
      { new: true, runValidators: true },
    );
    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("PATCH /api/sessions/:sessionId error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
