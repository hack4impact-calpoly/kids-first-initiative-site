import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import { getRequestActor, isPlainObject } from "@/lib/server/apiAuthorization";
import { canEducatorReadClassroom, DataPrincipal, resolveDataPrincipal } from "@/lib/server/classroomAuthorization";
import { parseGameDataProgress } from "@/lib/server/gameDataValidation";
import { ApiInputError } from "@/lib/server/apiErrors";
import { NextRequest, NextResponse } from "next/server";

type GameDataRecord = {
  userId: string;
  classroomSessionId?: string | null;
};

async function canReadGameData(principal: DataPrincipal, record: GameDataRecord) {
  return (
    record.userId === principal.ownerId ||
    principal.actor.role === "admin" ||
    (await canEducatorReadClassroom(principal.actor, record.classroomSessionId))
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ saveId: string }> }) {
  try {
    await connectDB();
    const principal = await resolveDataPrincipal(request, await getRequestActor());
    if (!principal.ok) return principal.response;

    const { saveId } = await params;
    const data = await GameData.findOne({ saveId }).lean<GameDataRecord | null>();
    if (!data || !(await canReadGameData(principal.value, data))) {
      return NextResponse.json({ error: "Game data not found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("GET /api/gameData/:saveId error:", error);
    return NextResponse.json({ error: "Failed to load game data" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ saveId: string }> }) {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const progress = parseGameDataProgress(rawBody);
    const claimedParticipantId =
      typeof rawBody.classroomParticipantId === "string" ? rawBody.classroomParticipantId.trim() : undefined;

    await connectDB();
    const principal = await resolveDataPrincipal(request, await getRequestActor(), claimedParticipantId);
    if (!principal.ok) return principal.response;

    const update: Record<string, unknown> = { $set: { lastUpdated: new Date() } };
    const completionAdditions: Record<string, unknown> = {};
    if (progress.completedLevels) {
      completionAdditions.completedLevels = { $each: progress.completedLevels };
    }
    if (progress.completedStageIds) {
      completionAdditions.completedStageIds = { $each: progress.completedStageIds };
    }
    if (Object.keys(completionAdditions).length > 0) {
      update.$addToSet = completionAdditions;
    }

    const { saveId } = await params;
    const updated = await GameData.findOneAndUpdate({ saveId, userId: principal.value.ownerId }, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) {
      return NextResponse.json({ error: "Game data not found" }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof ApiInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PATCH /api/gameData/:saveId error:", error);
    return NextResponse.json({ error: "Failed to update game data" }, { status: 500 });
  }
}
