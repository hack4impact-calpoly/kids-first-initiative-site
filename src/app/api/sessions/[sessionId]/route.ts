import connectDB from "@/database/db";
import Session from "@/database/sessionSchema";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
// GET and PATCH routes for sessions

/**
 * GET /api/sessions/:sessionId
 * Fetch a session by ID
 */
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    await connectDB();

    const { sessionId } = params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: session._id,
      anonUserId: session.anonUserId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    });
  } catch (error) {
    console.error("GET /api/sessions/:sessionId error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/:sessionId
 * Update a session (e.g., end it by setting endedAt and durationMs)
 * Body: { endedAt?: Date, durationMs?: number } or empty to auto-end
 */
export async function PATCH(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    await connectDB();

    const { sessionId } = params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // If body is empty or only endedAt/durationMs, allow update
    const update: { endedAt?: Date; durationMs?: number } = {};

    if (body.endedAt !== undefined) {
      update.endedAt = typeof body.endedAt === "string" ? new Date(body.endedAt) : body.endedAt;
    } else if (Object.keys(body).length === 0 || body.endSession) {
      // Auto-end: set endedAt to now and calculate duration
      const endedAt = new Date();
      update.endedAt = endedAt;
      update.durationMs = endedAt.getTime() - session.startedAt.getTime();
    }

    if (body.durationMs !== undefined) {
      update.durationMs = Number(body.durationMs);
    }

    const updatedSession = await Session.findByIdAndUpdate(sessionId, { $set: update }, { new: true });

    return NextResponse.json({
      _id: updatedSession!._id,
      anonUserId: updatedSession!.anonUserId,
      startedAt: updatedSession!.startedAt,
      endedAt: updatedSession!.endedAt,
      durationMs: updatedSession!.durationMs,
    });
  } catch (error) {
    console.error("PATCH /api/sessions/:sessionId error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
