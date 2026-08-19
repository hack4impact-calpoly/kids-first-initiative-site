import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import { getRequestActor, isPlainObject, requireAdmin } from "@/lib/server/apiAuthorization";
import { resolveDataPrincipal } from "@/lib/server/classroomAuthorization";
import { parseNewGameData } from "@/lib/server/gameDataValidation";
import { ApiInputError } from "@/lib/server/apiErrors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    await connectDB();
    const gameData = await GameData.find({}).sort({ lastUpdated: -1 }).lean();
    return NextResponse.json(gameData, { status: 200 });
  } catch (error) {
    console.error("GET /api/gameData error:", error);
    return NextResponse.json({ error: "Failed to load game data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const input = parseNewGameData(rawBody);
    const claimedParticipantId =
      typeof rawBody.classroomParticipantId === "string" ? rawBody.classroomParticipantId.trim() : undefined;

    await connectDB();
    const principal = await resolveDataPrincipal(request, await getRequestActor(), claimedParticipantId);
    if (!principal.ok) return principal.response;

    const gameData = await GameData.create({
      ...input,
      userId: principal.value.ownerId,
      lastUpdated: new Date(),
      classroomSessionId: principal.value.classroom?.sessionId ?? null,
      classroomParticipantId: principal.value.classroom?.participantId ?? null,
      studentDisplayName: principal.value.classroom?.displayName ?? null,
    });

    return NextResponse.json(gameData, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A save with that ID already exists" }, { status: 409 });
    }
    if (error instanceof ApiInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/gameData error:", error);
    return NextResponse.json({ error: "Failed to create game data" }, { status: 500 });
  }
}
