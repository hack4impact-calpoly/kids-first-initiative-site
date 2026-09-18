import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Run after next build: protects against accidentally publishing these guides as static assets.
const root = process.cwd();
const docs = readdirSync(path.join(root, "docs")).filter((file) => /\.(md|html)$/.test(file));
const tracePath = path.join(root, ".next/server/app/adminDashboard/docs/[[...slug]]/route.js.nft.json");
assert(existsSync(tracePath), "Missing private documentation server trace; run next build first.");
const traced = new Set(
  JSON.parse(readFileSync(tracePath, "utf8")).files.map((file) => path.resolve(path.dirname(tracePath), file)),
);
for (const file of docs)
  assert(traced.has(path.join(root, "docs", file)), `Guide missing from server function: ${file}`);

const prerender = JSON.parse(readFileSync(path.join(root, ".next/prerender-manifest.json"), "utf8"));
assert(
  !Object.keys(prerender.routes).some((route) => route.startsWith("/adminDashboard/docs")),
  "Documentation must never be prerendered.",
);

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file) : [file];
  });
}

const sources = docs.map((file) => ({ file, text: readFileSync(path.join(root, "docs", file), "utf8") }));
const markers = sources.map(({ file, text }) => {
  const marker = text
    .split("\n")
    .find((line) => line.trim().length > 65 && !/^[#|]/.test(line))
    ?.trim();
  assert(marker, `Add a useful disclosure marker for ${file}`);
  return { file, marker };
});
const publicFiles = filesBelow(path.join(root, "public"));
assert(!existsSync(path.join(root, "public/docs")), "Documentation must not have a public/docs directory.");
assert(
  !publicFiles.some((file) => path.extname(file) === ".md" && docs.includes(path.basename(file))),
  "Documentation found under public/.",
);

// All browser-readable text assets, including source maps. Server-only files are deliberately excluded.
const assets = [
  ...filesBelow(path.join(root, ".next/static")),
  ...publicFiles,
  // Prerendered HTML/RSC for other pages is also browser-readable, unlike server JS bundles.
  ...filesBelow(path.join(root, ".next/server/app")).filter((file) => /\.(html|rsc)$/.test(file)),
].filter((file) => /\.(js|json|map|html|rsc|txt|md|css)$/.test(file));
for (const asset of assets) {
  const text = readFileSync(asset, "utf8");
  for (const { file, marker } of markers) {
    assert(
      !text.includes(marker) && !text.includes(JSON.stringify(marker).slice(1, -1)),
      `${file} content leaked into ${path.relative(root, asset)}`,
    );
  }
}
console.log(
  `Private documentation verified: ${docs.length} server-traced guides; ${assets.length} public assets checked; no prerendered docs.`,
);
