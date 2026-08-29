import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/database/db";
import { currentRelease, reportError } from "@/lib/server/observability";

export const dynamic = "force-dynamic";

const GAMES = ["StatesOfMatter", "PenguinRun"] as const;

// Present in every promoted Unity build. Their absence means the artifact was copied incompletely,
// which otherwise only shows up as a blank canvas for a child.
const REQUIRED_BUILD_FILES = ["index.html", "_source_sha.txt", "_build_id.txt"];

type CheckStatus = "ok" | "degraded" | "down";

type GameCheck = {
  game: string;
  status: CheckStatus;
  sourceSha: string | null;
  buildId: string | null;
  builtAtUtc: string | null;
  missingFiles: string[];
};

async function readMarker(game: string, file: string) {
  try {
    const contents = await readFile(path.join(process.cwd(), "public", "game", game, file), "utf8");
    return contents.trim() || null;
  } catch {
    return null;
  }
}

async function checkGame(game: string): Promise<GameCheck> {
  const present = await Promise.all(
    REQUIRED_BUILD_FILES.map(async (file) => ({ file, found: (await readMarker(game, file)) !== null })),
  );
  const missingFiles = present.filter((entry) => !entry.found).map((entry) => entry.file);

  const [sourceSha, buildId, builtAtUtc] = await Promise.all([
    readMarker(game, "_source_sha.txt"),
    readMarker(game, "_build_id.txt"),
    readMarker(game, "_built_at_utc.txt"),
  ]);

  return {
    game,
    status: missingFiles.length === 0 ? "ok" : "down",
    sourceSha,
    buildId,
    builtAtUtc,
    missingFiles,
  };
}

async function checkDatabase(): Promise<{ status: CheckStatus; readyState: number }> {
  try {
    await connectDB();
    // 1 is "connected". Anything else means queries would buffer and eventually time out, which is
    // the failure mode that looks like a hang rather than an error.
    const readyState = mongoose.connection.readyState;
    return { status: readyState === 1 ? "ok" : "degraded", readyState };
  } catch (error) {
    reportError({ scope: "database", event: "health-check-failed", error });
    return { status: "down", readyState: mongoose.connection?.readyState ?? 0 };
  }
}

/**
 * Deployment health for the website and both embedded game builds.
 *
 * Deliberately unauthenticated and free of any learner data: it reports only build provenance and
 * connectivity, so it can be polled by an uptime monitor. The game source SHAs make it possible to
 * confirm which Unity revision is actually live, which is what a rollback needs to verify.
 */
export async function GET() {
  const [database, games] = await Promise.all([checkDatabase(), Promise.all(GAMES.map(checkGame))]);

  const statuses: CheckStatus[] = [database.status, ...games.map((game) => game.status)];
  const status: CheckStatus = statuses.includes("down") ? "down" : statuses.includes("degraded") ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      release: currentRelease(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      checkedAt: new Date().toISOString(),
      checks: { database, games },
    },
    // Non-2xx on failure so an uptime monitor alerts without needing to parse the body.
    { status: status === "ok" ? 200 : 503 },
  );
}
