import connectDB from "@/database/db";
import Session from "@/database/sessionSchema";
import { NextRequest, NextResponse } from "next/server";
// POST route for creating a new session

/**
 * POST /api/sessions
 * Create a new session
 * Body: { anonUserId: string }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { anonUserId } = body;

    if (!anonUserId || typeof anonUserId !== "string") {
      return NextResponse.json({ error: "anonUserId is required and must be a string" }, { status: 400 });
    }

    const startedAt = new Date();
    const session = await Session.create({
      anonUserId,
      startedAt,
      endedAt: null,
      durationMs: 0,
    });

    return NextResponse.json({
      _id: session._id,
      anonUserId: session.anonUserId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
