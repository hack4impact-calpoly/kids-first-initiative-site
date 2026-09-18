import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  connectDB: vi.fn(),
  connection: { readyState: 1 },
  reportError: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("mongoose", () => ({ default: { connection: mocks.connection } }));
vi.mock("@/database/db", () => ({ default: mocks.connectDB }));
vi.mock("@/lib/server/observability", () => ({
  currentRelease: () => "website-test-sha",
  reportError: mocks.reportError,
}));

import { GET } from "./route";

const contents: Record<string, string> = {
  "index.html": "<!doctype html><title>Game</title>",
  "_source_sha.txt": "game-test-sha\n",
  "_build_id.txt": "test-build\n",
  "_built_at_utc.txt": "2026-09-17T00:00:00Z\n",
};

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.connection.readyState = 1;
  mocks.connectDB.mockReset().mockResolvedValue(undefined);
  mocks.readFile.mockReset().mockImplementation(async (file: string) => contents[path.basename(file)]);
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("reports healthy dependencies and public provenance without caching the result", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      release: "website-test-sha",
      environment: "production",
      checkedAt: expect.any(String),
      checks: {
        database: { status: "ok", readyState: 1 },
        games: ["StatesOfMatter", "PenguinRun"].map((game) => ({
          game,
          status: "ok",
          sourceSha: "game-test-sha",
          buildId: "test-build",
          builtAtUtc: "2026-09-17T00:00:00Z",
          missingFiles: [],
        })),
      },
    });
  });

  it("returns an uncacheable 503 on database failure without exposing the error", async () => {
    const error = new Error("private connection details");
    mocks.connectDB.mockRejectedValue(error);
    mocks.connection.readyState = 0;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "down", checks: { database: { status: "down", readyState: 0 } } });
    expect(JSON.stringify(body)).not.toContain(error.message);
    expect(mocks.reportError).toHaveBeenCalledWith({ scope: "database", event: "health-check-failed", error });
  });

  it("reports a non-connected database as degraded with a 503", async () => {
    mocks.connection.readyState = 2;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "degraded" });
  });

  it.each(["index.html", "_source_sha.txt", "_build_id.txt"])(
    "reports an incomplete game when %s is missing or empty",
    async (missingFile) => {
      mocks.readFile.mockImplementation(async (file: string) => {
        if (file.includes("PenguinRun") && path.basename(file) === missingFile) {
          if (missingFile === "index.html") throw new Error("ENOENT");
          return "\n";
        }
        return contents[path.basename(file)];
      });
      const response = await GET();
      expect(response.status).toBe(503);
      expect((await response.json()).checks.games).toEqual([
        expect.objectContaining({ game: "StatesOfMatter", status: "ok" }),
        expect.objectContaining({ game: "PenguinRun", status: "down", missingFiles: [missingFile] }),
      ]);
    },
  );

  it("does not fail a build solely because its optional timestamp is missing", async () => {
    mocks.readFile.mockImplementation(async (file: string) => {
      if (path.basename(file) === "_built_at_utc.txt") throw new Error("ENOENT");
      return contents[path.basename(file)];
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(
      (await response.json()).checks.games.every((game: { builtAtUtc: unknown }) => game.builtAtUtc === null),
    ).toBe(true);
  });
});
