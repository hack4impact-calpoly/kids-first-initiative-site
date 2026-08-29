import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import { getRequestActor } from "@/lib/server/apiAuthorization";
import { resolveClassroomOwnerKeys, resolveDataPrincipal } from "@/lib/server/classroomAuthorization";
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_GAME_IDS = ["statesOfMatterGame", "penguinRunGame"];

/**
 * The caller's own saves, newest first.
 *
 * Distinct from `GET /api/gameData`, which is an administrator-wide listing. This returns only the
 * records the caller already owns, so it needs no additional authorization beyond resolving who they
 * are. A classroom participant's lineage is included, which is what lets a student who rejoins a
 * reopened class find the save they made before it — their owner key changed with their new
 * participant row, but the records did not move.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const principal = await resolveDataPrincipal(request, await getRequestActor());
    if (!principal.ok) return principal.response;
    if (!principal.value.ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerIds = principal.value.classroom
      ? await resolveClassroomOwnerKeys(principal.value.classroom)
      : [principal.value.ownerId];

    const requestedGameId = request.nextUrl.searchParams.get("gameId");
    const gameIdFilter =
      requestedGameId && SUPPORTED_GAME_IDS.includes(requestedGameId) ? requestedGameId : { $in: SUPPORTED_GAME_IDS };

    const saves = await GameData.find({ userId: { $in: ownerIds }, gameId: gameIdFilter })
      .select("saveId gameId lastUpdated completedLevels completedStageIds")
      .sort({ lastUpdated: -1 })
      .lean<
        Array<{
          saveId: string;
          gameId: string;
          lastUpdated: Date;
          completedLevels?: number[];
          completedStageIds?: string[];
        }>
      >();

    return NextResponse.json(
      {
        saves: saves.map((save) => ({
          saveId: save.saveId,
          gameId: save.gameId,
          lastUpdated: save.lastUpdated,
          completedLevelCount: save.completedLevels?.length ?? 0,
          completedStageCount: save.completedStageIds?.length ?? 0,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/gameData/mine error:", error);
    return NextResponse.json({ error: "Failed to load game data" }, { status: 500 });
  }
}
