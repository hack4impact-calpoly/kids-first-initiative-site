import connectDB from "@/database/db";
import Session from "@/database/sessionSchema";
import { NextRequest, NextResponse } from "next/server";

const VALID_GAME_IDS = new Set(["penguinRunGame", "statesOfMatterGame"]);

function getPeriodStart(period: string | null): Date | null {
  if (!period || period === "all") return null;

  const now = Date.now();
  if (period === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);

  return null;
}

/**
 * GET /api/sessions
 * Fetch all sessions
 * Query params:
 * - gameId?: penguinRunGame | statesOfMatterGame
 * - period?: 7d | 30d | all
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

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

    if (startedAfter) {
      filter.startedAt = { $gte: startedAfter };
    }

    const sessions = await Session.find(filter).sort({ startedAt: -1 });

    const serialized = sessions.map((session) => ({
      _id: session._id,
      anonUserId: session.anonUserId,
      gameId: session.gameId ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

/**
 * POST /api/sessions
 * Create a new session
 * Body: { anonUserId: string, gameId?: "penguinRunGame" | "statesOfMatterGame" }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { anonUserId, gameId } = body;

    if (!anonUserId || typeof anonUserId !== "string") {
      return NextResponse.json({ error: "anonUserId is required and must be a string" }, { status: 400 });
    }

    if (gameId !== undefined && (typeof gameId !== "string" || !VALID_GAME_IDS.has(gameId))) {
      return NextResponse.json({ error: "gameId must be one of: penguinRunGame, statesOfMatterGame" }, { status: 400 });
    }

    const startedAt = new Date();
    const session = await Session.create({
      anonUserId,
      gameId: gameId ?? null,
      startedAt,
      endedAt: null,
      durationMs: 0,
    });

    return NextResponse.json({
      _id: session._id,
      anonUserId: session.anonUserId,
      gameId: session.gameId ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
