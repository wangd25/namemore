import type {
  CategoryAvailability,
  CategoryDiscoveryEntry,
  CategoryDiscoveryPayload,
  CategoryDraftPayload,
  CategoryReviewStatus,
} from "@/lib/category-discovery-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlCharacters = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0 || controlCharacters.test(value)) {
    throw new Error(`Invalid ${key}.`);
  }
  return value;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${key}.`);
  }
  return value as number;
}

function readNullableInteger(record: Record<string, unknown>, key: string): number | null {
  return record[key] === null ? null : readInteger(record, key);
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`Invalid ${key}.`);
  return value;
}

function parseCategory(value: unknown): CategoryDiscoveryEntry {
  if (!isRecord(value)) throw new Error("Invalid category.");
  const reviewStatus = readString(value, "reviewStatus");
  const availability = readString(value, "availability");
  if (!(new Set<CategoryReviewStatus>(["reviewed", "in-review"]) as Set<string>).has(reviewStatus)) {
    throw new Error("Invalid review status.");
  }
  if (!(new Set<CategoryAvailability>(["daily", "practice-planned"]) as Set<string>).has(availability)) {
    throw new Error("Invalid availability.");
  }
  const entry: CategoryDiscoveryEntry = {
    slug: readString(value, "slug"),
    version: readNullableInteger(value, "version"),
    title: readString(value, "title"),
    prompt: readString(value, "prompt"),
    summary: readString(value, "summary"),
    reviewStatus: reviewStatus as CategoryReviewStatus,
    availability: availability as CategoryAvailability,
    competitiveEligible: readBoolean(value, "competitiveEligible"),
    answerCount: readNullableInteger(value, "answerCount"),
    sourceLabel: readString(value, "sourceLabel"),
    coverageNote: readString(value, "coverageNote"),
  };
  if (entry.reviewStatus === "reviewed" && (entry.version === null || entry.answerCount === null)) {
    throw new Error("Reviewed categories require a versioned answer bank.");
  }
  return entry;
}

function parseNullableRecord<T>(
  value: unknown,
  parser: (record: Record<string, unknown>) => T,
): T | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("Invalid ambient metric.");
  return parser(value);
}

export function parseCategoryDiscoveryPayload(value: unknown): CategoryDiscoveryPayload {
  if (!isRecord(value) || !Array.isArray(value.categories) || !isRecord(value.ambient)) {
    throw new Error("Invalid category discovery payload.");
  }
  return {
    serverNow: readString(value, "serverNow"),
    categories: value.categories.map(parseCategory),
    ambient: {
      todayBest: parseNullableRecord(value.ambient.todayBest, (record) => ({
        score: readInteger(record, "score"),
        categoryTitle: readString(record, "categoryTitle"),
      })),
      popularCategory: parseNullableRecord(value.ambient.popularCategory, (record) => ({
        categoryTitle: readString(record, "categoryTitle"),
        verifiedRoundCount: readInteger(record, "verifiedRoundCount"),
      })),
      liveRooms: parseNullableRecord(value.ambient.liveRooms, (record) => ({
        roomCount: readInteger(record, "roomCount"),
      })),
    },
  };
}

export function parseCategoryDraftPayload(value: unknown): CategoryDraftPayload {
  if (!isRecord(value)) throw new Error("Invalid category draft payload.");
  const id = readString(value, "id");
  if (!uuidPattern.test(id) || value.status !== "draft" || value.reviewStatus !== "unreviewed") {
    throw new Error("Invalid category draft state.");
  }
  if (value.competitiveEligible !== false) throw new Error("Invalid draft eligibility.");
  return {
    id,
    status: "draft",
    reviewStatus: "unreviewed",
    competitiveEligible: false,
    createdAt: readString(value, "createdAt"),
  };
}

export function normalizeDiscoveryQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 80 || controlCharacters.test(value)) return null;
  return normalized;
}

export function parseCategoryDraftRequest(value: unknown): {
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
} | null {
  if (!isRecord(value)) return null;
  const fields = [value.prompt, value.sourceNotes, value.coverageNotes];
  if (fields.some((field) => typeof field !== "string" || controlCharacters.test(field))) return null;
  const prompt = (value.prompt as string).trim().replace(/\s+/g, " ");
  const sourceNotes = (value.sourceNotes as string).trim().replace(/\s+/g, " ");
  const coverageNotes = (value.coverageNotes as string).trim().replace(/\s+/g, " ");
  if (
    prompt.length < 4 || prompt.length > 160 ||
    sourceNotes.length < 8 || sourceNotes.length > 500 ||
    coverageNotes.length < 8 || coverageNotes.length > 500
  ) return null;
  return { prompt, sourceNotes, coverageNotes };
}
