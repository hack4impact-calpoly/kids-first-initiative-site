import connectDB from "@/database/db";
import Session from "@/database/sessionSchema";
import { getRequestActor, isPlainObject, requireAdmin, requireSignedIn } from "@/lib/server/apiAuthorization";
import { NextRequest, NextResponse } from "next/server";

const VALID_GAME_IDS = new Set(["penguinRunGame", "statesOfMatterGame"]);

function getPeriodStart(period: string | null): Date | null {
  if (!period || period === "all") return null;

  const now = Date.now();
  if (period === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const period = searchParams.get("period");
    const startedAfter = getPeriodStart(period);
    const filter: Record<string, unknown> = {};

    if (gameId) {
      if (!VALID_GAME_IDS.has(gameId)) {
        return NextResponse.json(
          { error: "gameId must be one of: penguinRunGame, statesOfMatterGame" },
          { status: 400 },
        );
      }
      filter.gameId = gameId;
    }
    if (period && !["7d", "30d", "all"].includes(period)) {
      return NextResponse.json({ error: "period must be one of: 7d, 30d, all" }, { status: 400 });
    }
    if (startedAfter) filter.startedAt = { $gte: startedAfter };

    await connectDB();
    const sessions = await Session.find(filter).sort({ startedAt: -1 });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const signedIn = requireSignedIn(await getRequestActor());
    if (!signedIn.ok) return signedIn.response;

    const rawBody: unknown = await request.json();
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const gameId = rawBody.gameId;
    if (gameId !== undefined && (typeof gameId !== "string" || !VALID_GAME_IDS.has(gameId))) {
      return NextResponse.json({ error: "gameId must be one of: penguinRunGame, statesOfMatterGame" }, { status: 400 });
    }

    await connectDB();
    const session = await Session.create({
      anonUserId: signedIn.value.userId,
      gameId: gameId ?? null,
      startedAt: new Date(),
      endedAt: null,
      durationMs: 0,
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
