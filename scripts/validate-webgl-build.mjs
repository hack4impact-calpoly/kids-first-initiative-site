#!/usr/bin/env node
/**
 * Validates an embedded Unity WebGL build.
 *
 * A build that is missing or truncated does not fail loudly — it renders as a blank canvas for a
 * child, which is the worst possible way to find out. This checks the things that must be true for
 * the build to boot at all, so an incomplete promotion fails in CI instead of in a classroom.
 *
 * Usage: node scripts/validate-webgl-build.mjs [gameDir ...]
 *        node scripts/validate-webgl-build.mjs --root <dir> StatesOfMatter PenguinRun
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const MARKERS = ["_build_id.txt", "_source_sha.txt", "_source_repository.txt", "_built_at_utc.txt"];

// Unity emits these with varying compression suffixes depending on build settings, so match by role.
const REQUIRED_ASSET_PATTERNS = [
  { role: "loader", pattern: /\.loader\.js$/ },
  { role: "framework", pattern: /\.framework\.js(\.(br|gz))?$/ },
  { role: "wasm", pattern: /\.wasm(\.(br|gz))?$/ },
  { role: "data", pattern: /\.data(\.(br|gz))?$/ },
];

const MIN_ASSET_BYTES = 1024;

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function validateGame(root, game) {
  const problems = [];
  const gameDir = path.join(root, game);

  if (!(await exists(gameDir))) {
    return [`${game}: directory not found at ${gameDir}`];
  }

  const indexPath = path.join(gameDir, "index.html");
  if (!(await exists(indexPath))) {
    problems.push(`${game}: index.html is missing`);
  }

  for (const marker of MARKERS) {
    const markerPath = path.join(gameDir, marker);
    if (!(await exists(markerPath))) {
      problems.push(`${game}: provenance marker ${marker} is missing`);
      continue;
    }
    const contents = (await readFile(markerPath, "utf8")).trim();
    if (!contents) problems.push(`${game}: provenance marker ${marker} is empty`);
  }

  const buildDir = path.join(gameDir, "Build");
  if (!(await exists(buildDir))) {
    problems.push(`${game}: Build/ directory is missing`);
    return problems;
  }

  const entries = await readdir(buildDir);
  for (const { role, pattern } of REQUIRED_ASSET_PATTERNS) {
    const match = entries.find((entry) => pattern.test(entry));
    if (!match) {
      problems.push(`${game}: no ${role} asset found in Build/`);
      continue;
    }

    // A zero-byte or near-empty asset is the signature of a truncated copy, which is otherwise
    // indistinguishable from a healthy build by file listing alone.
    const { size } = await stat(path.join(buildDir, match));
    if (size < MIN_ASSET_BYTES) {
      problems.push(`${game}: ${role} asset ${match} is only ${size} bytes, which cannot be a real build`);
    }
  }

  if (await exists(indexPath)) {
    const html = await readFile(indexPath, "utf8");
    if (!/\.loader\.js/.test(html)) {
      problems.push(`${game}: index.html does not reference a loader script`);
    }
  }

  return problems;
}

async function main() {
  const argv = process.argv.slice(2);
  let root = path.join(process.cwd(), "public", "game");

  const rootFlag = argv.indexOf("--root");
  if (rootFlag !== -1) {
    root = path.resolve(argv[rootFlag + 1]);
    argv.splice(rootFlag, 2);
  }

  const games = argv.length ? argv : ["StatesOfMatter", "PenguinRun"];
  const problems = (await Promise.all(games.map((game) => validateGame(root, game)))).flat();

  if (problems.length) {
    console.error("WebGL build validation failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`WebGL build validation passed for: ${games.join(", ")}`);
}

await main();
