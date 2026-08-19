import { ApiInputError } from "@/lib/server/apiErrors";

export const GAME_IDS = ["PenguinRun", "StatesOfMatter", "penguinRunGame", "statesOfMatterGame"] as const;

function requireString(value: unknown, field: string, maxLength = 160) {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new ApiInputError(`${field} must be a non-empty string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

export function parseIntegerArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isInteger(item))) {
    throw new ApiInputError(`${field} must be an array of integers`);
  }
  return Array.from(new Set(value));
}

export function parseStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" && item.trim().length > 0 && item.trim().length <= 160)
  ) {
    throw new ApiInputError(`${field} must be an array of non-empty strings`);
  }
  return Array.from(new Set(value.map((item) => item.trim())));
}

export function parseNewGameData(body: Record<string, unknown>) {
  const saveVersion = body.saveVersion;
  if (typeof saveVersion !== "number" || !Number.isInteger(saveVersion) || saveVersion < 1) {
    throw new ApiInputError("saveVersion must be a positive integer");
  }

  const gameId = requireString(body.gameId, "gameId", 80);
  if (!GAME_IDS.includes(gameId as (typeof GAME_IDS)[number])) {
    throw new ApiInputError(`gameId must be one of: ${GAME_IDS.join(", ")}`);
  }

  return {
    saveId: requireString(body.saveId, "saveId", 160),
    saveVersion,
    gameVersion: requireString(body.gameVersion, "gameVersion", 80),
    gameId,
    completedLevels:
      body.completedLevels === undefined ? [] : parseIntegerArray(body.completedLevels, "completedLevels"),
    completedStageIds:
      body.completedStageIds === undefined ? [] : parseStringArray(body.completedStageIds, "completedStageIds"),
  };
}

export function parseGameDataProgress(body: Record<string, unknown>) {
  const hasCompletedLevels = Object.prototype.hasOwnProperty.call(body, "completedLevels");
  const hasCompletedStageIds = Object.prototype.hasOwnProperty.call(body, "completedStageIds");

  if (!hasCompletedLevels && !hasCompletedStageIds) {
    throw new ApiInputError("At least one completion field is required");
  }

  return {
    completedLevels: hasCompletedLevels ? parseIntegerArray(body.completedLevels, "completedLevels") : undefined,
    completedStageIds: hasCompletedStageIds ? parseStringArray(body.completedStageIds, "completedStageIds") : undefined,
  };
}
