import type { Category, CategoryAnswer } from "@/lib/category-types";
import { toStableAnswerId } from "@/lib/normalize";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const controlCharacters = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string, maximum: number): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || controlCharacters.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

function parseAnswer(value: unknown, slug: string): CategoryAnswer {
  if (!isRecord(value) || !Array.isArray(value.aliases) || value.aliases.length > 20) {
    throw new Error("Invalid practice answer.");
  }
  const canonicalText = readString(value, "canonicalText", 160);
  const aliases = value.aliases.map((alias) => {
    if (typeof alias !== "string" || alias.length === 0 || alias.length > 160 || controlCharacters.test(alias)) {
      throw new Error("Invalid practice alias.");
    }
    return alias;
  });
  return { id: `${slug}-${toStableAnswerId(canonicalText)}`, canonicalText, aliases };
}

export function parsePublishedPracticeCategory(value: unknown): Category {
  if (!isRecord(value) || value.competitiveEligible !== false || !Array.isArray(value.answers)
    || value.answers.length < 2 || value.answers.length > 500) {
    throw new Error("Invalid practice category.");
  }
  const slug = readString(value, "slug", 80);
  const snapshotDate = readString(value, "snapshotDate", 10);
  if (!slugPattern.test(slug) || !datePattern.test(snapshotDate)
    || typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 1
    || typeof value.timeLimitSeconds !== "number" || !Number.isSafeInteger(value.timeLimitSeconds)
    || value.timeLimitSeconds < 10 || value.timeLimitSeconds > 600) {
    throw new Error("Invalid practice category metadata.");
  }
  return {
    slug,
    version: value.version,
    snapshotDate,
    title: readString(value, "title", 120),
    prompt: readString(value, "prompt", 240),
    timeLimitSeconds: value.timeLimitSeconds,
    inputLabel: readString(value, "inputLabel", 120),
    inputPlaceholder: readString(value, "inputPlaceholder", 120),
    sourceLabel: readString(value, "sourceLabel", 160),
    answers: value.answers.map((answer) => parseAnswer(answer, slug)),
  };
}
