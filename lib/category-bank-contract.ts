import { normalizeAnswer } from "@/lib/normalize";
import type {
  CategoryBankAnswer,
  CategoryBankPayload,
  CategoryBankQueueItem,
  CategoryBankQueuePayload,
  CategoryBankSaveInput,
  CategoryBankStatus,
  CategoryBankTextValidation,
} from "@/lib/category-bank-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const statuses = new Set<CategoryBankStatus>(["editing", "review-ready"]);

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

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  return readString(record, key);
}

function readTimestamp(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${key}.`);
  return value;
}

function readPositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`Invalid ${key}.`);
  return value as number;
}

function parseAnswer(value: unknown): CategoryBankAnswer {
  if (!isRecord(value) || !Array.isArray(value.aliases) || value.aliases.length > 20) {
    throw new Error("Invalid bank answer.");
  }
  const canonicalText = readString(value, "canonicalText");
  if (canonicalText.length > 160) throw new Error("Invalid bank answer.");
  const aliases = value.aliases.map((alias) => {
    if (typeof alias !== "string" || alias.length === 0 || alias.length > 160 || controlCharacters.test(alias)) {
      throw new Error("Invalid bank alias.");
    }
    return alias;
  });
  return { canonicalText, aliases };
}

export function parseCategoryBankPayload(value: unknown): CategoryBankPayload {
  if (!isRecord(value) || !Array.isArray(value.answers) || value.competitiveEligible !== false) {
    throw new Error("Invalid category bank payload.");
  }
  const draftId = readString(value, "draftId");
  const status = readString(value, "status");
  const snapshotDate = readNullableString(value, "snapshotDate");
  const submittedAt = value.submittedAt === null ? null : readTimestamp(value, "submittedAt");
  const timeLimitSeconds = value.timeLimitSeconds;
  if (!uuidPattern.test(draftId) || !statuses.has(status as CategoryBankStatus)) {
    throw new Error("Invalid category bank payload.");
  }
  if (snapshotDate !== null && (!datePattern.test(snapshotDate) || Number.isNaN(Date.parse(`${snapshotDate}T00:00:00Z`)))) {
    throw new Error("Invalid snapshotDate.");
  }
  if (timeLimitSeconds !== null && (!Number.isSafeInteger(timeLimitSeconds) || (timeLimitSeconds as number) < 10 || (timeLimitSeconds as number) > 600)) {
    throw new Error("Invalid timeLimitSeconds.");
  }
  if ((status === "editing") !== (submittedAt === null)) throw new Error("Invalid bank lifecycle.");
  return {
    draftId,
    prompt: readString(value, "prompt"),
    sourceNotes: readString(value, "sourceNotes"),
    coverageNotes: readString(value, "coverageNotes"),
    revision: readPositiveInteger(value, "revision"),
    status: status as CategoryBankStatus,
    snapshotDate,
    timeLimitSeconds: timeLimitSeconds as number | null,
    sourceLabel: readNullableString(value, "sourceLabel"),
    sourceUrl: readNullableString(value, "sourceUrl"),
    versionNote: readNullableString(value, "versionNote"),
    competitiveEligible: false,
    updatedAt: readTimestamp(value, "updatedAt"),
    submittedAt,
    answers: value.answers.map(parseAnswer),
  };
}

function parseQueueItem(value: unknown): CategoryBankQueueItem {
  if (!isRecord(value) || typeof value.available !== "boolean") throw new Error("Invalid bank queue item.");
  const draftId = readString(value, "draftId");
  const status = readString(value, "status");
  const revision = value.revision;
  if (!uuidPattern.test(draftId) || !["not-started", "editing", "review-ready"].includes(status)) {
    throw new Error("Invalid bank queue item.");
  }
  if (!Number.isSafeInteger(revision) || (revision as number) < 0 || (status === "not-started") !== (revision === 0)) {
    throw new Error("Invalid bank revision.");
  }
  const bank = value.bank === null ? null : parseCategoryBankPayload(value.bank);
  if (bank && (bank.draftId !== draftId || bank.status !== status || bank.revision !== revision)) {
    throw new Error("Invalid bank queue projection.");
  }
  return {
    draftId,
    prompt: readString(value, "prompt"),
    sourceNotes: readString(value, "sourceNotes"),
    coverageNotes: readString(value, "coverageNotes"),
    revision: revision as number,
    status: status as CategoryBankQueueItem["status"],
    available: value.available,
    bank,
  };
}

export function parseCategoryBankQueuePayload(value: unknown): CategoryBankQueuePayload {
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.drafts)) {
    throw new Error("Invalid category bank queue payload.");
  }
  return {
    serverNow: readTimestamp(value, "serverNow"),
    authorized: true,
    drafts: value.drafts.map(parseQueueItem),
  };
}

export function parseAnswerBankText(value: string): CategoryBankTextValidation {
  const errors: string[] = [];
  const answers: CategoryBankAnswer[] = [];
  const seen = new Map<string, string>();
  const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) errors.push("Add at least one canonical answer.");
  if (lines.length > 500) errors.push("Use no more than 500 canonical answers.");

  for (const [lineIndex, line] of lines.slice(0, 500).entries()) {
    if (controlCharacters.test(line.replace(/\t/g, ""))) {
      errors.push(`Line ${lineIndex + 1} contains a control character.`);
      continue;
    }
    const parts = line.split("|").map((part) => part.trim().replace(/\s+/g, " "));
    const canonicalText = parts[0] ?? "";
    const aliases = parts.slice(1);
    if (!canonicalText || canonicalText.length > 160) {
      errors.push(`Line ${lineIndex + 1} has an invalid canonical answer.`);
      continue;
    }
    if (aliases.length > 20 || aliases.some((alias) => !alias || alias.length > 160)) {
      errors.push(`Line ${lineIndex + 1} has invalid aliases.`);
      continue;
    }
    for (const label of [canonicalText, ...aliases]) {
      const normalized = normalizeAnswer(label);
      if (!normalized) {
        errors.push(`Line ${lineIndex + 1} contains an empty normalized answer.`);
      } else if (seen.has(normalized)) {
        errors.push(`“${label}” collides with “${seen.get(normalized)}”.`);
      } else {
        seen.set(normalized, label);
      }
    }
    answers.push({ canonicalText, aliases });
  }

  return {
    answers,
    canonicalCount: answers.length,
    aliasCount: answers.reduce((total, answer) => total + answer.aliases.length, 0),
    errors: [...new Set(errors)],
  };
}

export function formatAnswerBankText(answers: CategoryBankAnswer[]): string {
  return answers.map((answer) => [answer.canonicalText, ...answer.aliases].join(" | ")).join("\n");
}

export function parseCategoryBankSaveRequest(value: unknown): CategoryBankSaveInput | null {
  if (!isRecord(value) || !Array.isArray(value.answers)) return null;
  const { snapshotDate, timeLimitSeconds, sourceLabel, sourceUrl, versionNote } = value;
  if (typeof snapshotDate !== "string" || !datePattern.test(snapshotDate)
    || Number.isNaN(Date.parse(`${snapshotDate}T00:00:00Z`))
    || !Number.isSafeInteger(timeLimitSeconds) || (timeLimitSeconds as number) < 10 || (timeLimitSeconds as number) > 600
    || typeof sourceLabel !== "string" || typeof sourceUrl !== "string" || typeof versionNote !== "string"
    || controlCharacters.test(sourceLabel) || controlCharacters.test(sourceUrl) || controlCharacters.test(versionNote)) return null;
  const normalizedLabel = sourceLabel.trim().replace(/\s+/g, " ");
  const normalizedNote = versionNote.trim().replace(/\s+/g, " ");
  if (normalizedLabel.length < 3 || normalizedLabel.length > 160
    || normalizedNote.length < 8 || normalizedNote.length > 500
    || sourceUrl.length < 12 || sourceUrl.length > 500 || !/^https:\/\/\S+$/.test(sourceUrl)) return null;
  try {
    const answers = value.answers.map(parseAnswer);
    if (answers.length < 1 || answers.length > 500) return null;
    return { snapshotDate, timeLimitSeconds: timeLimitSeconds as number, sourceLabel: normalizedLabel, sourceUrl, versionNote: normalizedNote, answers };
  } catch {
    return null;
  }
}
