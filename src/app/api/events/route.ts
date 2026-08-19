import connectDB from "@/database/db";
import Event from "@/database/eventSchema";
import Session from "@/database/sessionSchema";
import { getRequestActor, isPlainObject, requireAdmin } from "@/lib/server/apiAuthorization";
import { resolveDataPrincipal } from "@/lib/server/classroomAuthorization";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

function normalizeEventProps(value: unknown) {
  if (!isPlainObject(value)) return {};

  return {
    ...(typeof value.gameId === "string" ? { gameId: value.gameId.slice(0, 80) } : {}),
    ...(typeof value.durationMs === "number" && Number.isFinite(value.durationMs)
      ? { durationMs: value.durationMs }
      : {}),
    ...(typeof value.result === "string" ? { result: value.result.slice(0, 160) } : {}),
    ...(typeof value.levelCompleted === "number" && Number.isInteger(value.levelCompleted)
      ? { levelCompleted: value.levelCompleted }
      : {}),
    ...(typeof value.activityId === "string" ? { activityId: value.activityId.slice(0, 160) } : {}),
    ...(typeof value.stageId === "string" ? { stageId: value.stageId.slice(0, 160) } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const anonUserId = searchParams.get("anonUserId");
    const event = searchParams.get("event");
    const sessionId = searchParams.get("sessionId");
    const filter: Record<string, unknown> = {};

    if (anonUserId) filter.anonUserId = anonUserId;
    if (event) filter.event = event;
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
      }
      filter.sessionId = new mongoose.Types.ObjectId(sessionId);
    }

    await connectDB();
    const events = await Event.find(filter).sort({ ts: -1 });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const eventId = typeof rawBody.eventId === "string" ? rawBody.eventId.trim() : "";
    const event = typeof rawBody.event === "string" ? rawBody.event.trim() : "";
    const sessionId = typeof rawBody.sessionId === "string" ? rawBody.sessionId.trim() : "";
    const classroomParticipantId =
      typeof rawBody.classroomParticipantId === "string" ? rawBody.classroomParticipantId.trim() : undefined;
    if (
      !eventId ||
      eventId.length > 200 ||
      !event ||
      event.length > 80 ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return NextResponse.json({ error: "Invalid eventId, event, or sessionId" }, { status: 400 });
    }

    await connectDB();
    const principal = await resolveDataPrincipal(request, await getRequestActor(), classroomParticipantId);
    if (!principal.ok) return principal.response;

    if (principal.value.classroom) {
      if (principal.value.classroom.sessionId !== sessionId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    } else {
      const ownsSession = await Session.exists({ _id: sessionId, anonUserId: principal.value.ownerId });
      if (!ownsSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    }

    const saved = await Event.create({
      eventId,
      ts: new Date(),
      anonUserId: principal.value.ownerId,
      sessionId: new mongoose.Types.ObjectId(sessionId),
      event,
      props: normalizeEventProps(rawBody.props),
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "An event with this eventId already exists" }, { status: 409 });
    }
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to create an event" }, { status: 500 });
  }
}
