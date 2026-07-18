import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  projectRoot,
  ".next/server/app/page_client-reference-manifest.js",
);
const manifest = await readFile(manifestPath, "utf8");
const chunkPaths = [
  ...new Set(
    [...manifest.matchAll(/\/_next\/(static\/chunks\/[^"]+\.js)/g)].map(
      (match) => match[1],
    ),
  ),
];

if (chunkPaths.length === 0) {
  throw new Error("Could not identify the page's client chunks.");
}

const bundle = (
  await Promise.all(
    chunkPaths.map((path) => readFile(resolve(projectRoot, ".next", path), "utf8")),
  )
).join("\n");

const forbiddenAnswerBankMarkers = [
  "Stephen Curry",
  "Nikola Jokić",
  "LeBron James",
  "nba-stephen-curry",
  "nbaRosters",
];
const leaked = forbiddenAnswerBankMarkers.filter((marker) => bundle.includes(marker));

if (leaked.length > 0) {
  throw new Error(`Client bundle leaked answer-bank markers: ${leaked.join(", ")}`);
}

console.log(`Audited ${chunkPaths.length} page client chunks: no answer-bank markers found.`);
