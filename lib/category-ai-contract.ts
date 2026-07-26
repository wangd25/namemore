import { normalizeAnswer } from "@/lib/normalize";
import type {
  CategoryAiDraftPayload,
  CategoryAiSourceSuggestion,
} from "@/lib/category-ai-types";
import type { CategoryBankAnswer } from "@/lib/category-bank-types";

const controlCharacters = /[\u0000-\u001f\u007f]/;
const modelPattern = /^[a-z0-9][a-z0-9._-]{1,79}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, minimum: number, maximum: number): string {
  if (typeof value !== "string" || controlCharacters.test(value)) {
    throw new Error("Invalid AI category text.");
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error("Invalid AI category text.");
  }
  return normalized;
}

function readSource(value: unknown): CategoryAiSourceSuggestion {
  if (!isRecord(value)) throw new Error("Invalid AI source suggestion.");
  const label = readText(value.label, 3, 160);
  const url = readText(value.url, 12, 500);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid AI source suggestion.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:"
    || parsed.username || parsed.password
    || hostname === "localhost" || hostname.endsWith(".local")
    || /^\d+(?:\.\d+){3}$/.test(hostname)
    || hostname.includes(":")) {
    throw new Error("Invalid AI source suggestion.");
  }
  return { label, url: parsed.toString() };
}

function readAnswers(value: unknown): CategoryBankAnswer[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 200) {
    throw new Error("Invalid AI answer bank.");
  }
  const seen = new Map<string, string>();
  return value.map((entry) => {
    if (!isRecord(entry) || !Array.isArray(entry.aliases) || entry.aliases.length > 10) {
      throw new Error("Invalid AI answer bank.");
    }
    const canonicalText = readText(entry.canonicalText, 1, 160);
    const aliases = entry.aliases.map((alias) => readText(alias, 1, 160));
    for (const label of [canonicalText, ...aliases]) {
      const normalized = normalizeAnswer(label);
      const previous = seen.get(normalized);
      if (!normalized || previous) {
        throw new Error(
          previous
            ? `AI answer collision between “${previous}” and “${label}”.`
            : "Invalid AI answer bank.",
        );
      }
      seen.set(normalized, label);
    }
    return { canonicalText, aliases };
  });
}

export function parseCategoryAiCandidate(value: unknown): {
  answers: CategoryBankAnswer[];
  sourceSuggestions: CategoryAiSourceSuggestion[];
  coverageWarnings: string[];
} {
  if (!isRecord(value)
    || !Array.isArray(value.sourceSuggestions)
    || value.sourceSuggestions.length < 1
    || value.sourceSuggestions.length > 6
    || !Array.isArray(value.coverageWarnings)
    || value.coverageWarnings.length > 8) {
    throw new Error("Invalid AI category draft.");
  }
  return {
    answers: readAnswers(value.answers),
    sourceSuggestions: value.sourceSuggestions.map(readSource),
    coverageWarnings: value.coverageWarnings.map((warning) => readText(warning, 4, 300)),
  };
}

export function createCategoryAiDraftPayload(
  value: unknown,
  model: string,
  generatedAt = new Date().toISOString(),
): CategoryAiDraftPayload {
  const candidate = parseCategoryAiCandidate(value);
  if (!modelPattern.test(model) || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Invalid AI category metadata.");
  }
  return {
    status: "needs-verification",
    model,
    generatedAt,
    ...candidate,
    validation: {
      canonicalCount: candidate.answers.length,
      aliasCount: candidate.answers.reduce(
        (total, answer) => total + answer.aliases.length,
        0,
      ),
    },
  };
}

export function parseCategoryAiDraftPayload(value: unknown): CategoryAiDraftPayload {
  if (!isRecord(value)
    || value.status !== "needs-verification"
    || !isRecord(value.validation)) {
    throw new Error("Invalid AI category draft.");
  }
  const payload = createCategoryAiDraftPayload(
    {
      answers: value.answers,
      sourceSuggestions: value.sourceSuggestions,
      coverageWarnings: value.coverageWarnings,
    },
    readText(value.model, 2, 80),
    readText(value.generatedAt, 10, 40),
  );
  if (value.validation.canonicalCount !== payload.validation.canonicalCount
    || value.validation.aliasCount !== payload.validation.aliasCount) {
    throw new Error("Invalid AI category validation summary.");
  }
  return payload;
}
