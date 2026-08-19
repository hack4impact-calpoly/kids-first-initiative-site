import { describe, expect, it } from "vitest";
import { parseGameDataProgress, parseNewGameData } from "@/lib/server/gameDataValidation";

describe("game data input allowlists", () => {
  it("returns only supported creation fields and removes duplicate progress", () => {
    const parsed = parseNewGameData({
      saveId: "save-1",
      saveVersion: 1,
      gameVersion: "1.0.0",
      gameId: "PenguinRun",
      completedLevels: [1, 1, 2],
      userId: "forged-user",
      classroomSessionId: "forged-session",
      studentDisplayName: "Forged Name",
      role: "admin",
    });

    expect(parsed).toEqual({
      saveId: "save-1",
      saveVersion: 1,
      gameVersion: "1.0.0",
      gameId: "PenguinRun",
      completedLevels: [1, 2],
      completedStageIds: [],
    });
    expect(parsed).not.toHaveProperty("userId");
  });

  it("accepts only completion arrays during progress updates", () => {
    expect(parseGameDataProgress({ completedStageIds: ["pipes", "pipes", "sorting"], userId: "forged" })).toEqual({
      completedLevels: undefined,
      completedStageIds: ["pipes", "sorting"],
    });
    expect(() => parseGameDataProgress({ userId: "forged" })).toThrow("At least one completion field is required");
  });

  it("rejects unknown games and malformed progress", () => {
    expect(() =>
      parseNewGameData({
        saveId: "save-1",
        saveVersion: 1,
        gameVersion: "1.0.0",
        gameId: "NotARealGame",
      }),
    ).toThrow("gameId must be one of");
    expect(() => parseGameDataProgress({ completedLevels: [1, "2"] })).toThrow(
      "completedLevels must be an array of integers",
    );
  });
});
