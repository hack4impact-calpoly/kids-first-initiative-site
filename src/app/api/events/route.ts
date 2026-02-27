import connectDB from "@/database/db";
import Event from "@/database/eventSchema";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const anonUserId = searchParams.get("anonUserId");
    const event = searchParams.get("event");
    const sessionId = searchParams.get("sessionId");

    const filter: Record<string, any> = {};

    if (anonUserId) filter.anonUserId = anonUserId;
    if (event) filter.event = event;
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
      }
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }

    const events = await Event.find(filter).sort({ ts: -1 });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { eventId, ts, anonUserId, sessionId, event, props } = body;

    if (!eventId || !anonUserId || !sessionId || !event) {
      return NextResponse.json(
        { error: "Missing required fields: eventId, anonUserId, sessionId, event" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const newEvent = new Event({
      eventId,
      ts: ts ? new Date(ts) : new Date(),
      anonUserId,
      sessionId: new mongoose.Types.ObjectId(sessionId),
      event,
      props: props ?? {},
    });

    const saved = await newEvent.save();

    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ error: "an event with this eventId already exists" }, { status: 409 });
    }
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "failed to create an event" }, { status: 500 });
  }
}
