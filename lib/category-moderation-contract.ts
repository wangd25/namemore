import type {
  CategoryModerationDecisionInput,
  CategoryModerationDecisionPayload,
  CategoryModerationOutcome,
  CategoryModerationQueueItem,
  CategoryModerationQueuePayload,
  CategoryModeratorStatusPayload,
  CategoryReportInput,
  CategoryReportReason,
  CategoryReportReceipt,
  CategoryReportStatus,
} from "@/lib/category-moderation-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const reasons = new Set<CategoryReportReason>([
  "answer-bank-accuracy",
  "coverage-or-wording",
  "provenance-or-copyright",
  "offensive-or-unsafe",
  "other",
]);
const outcomes = new Set<CategoryModerationOutcome>(["dismiss", "publisher-review"]);
const statuses = new Set<CategoryReportStatus>(["pending", "dismissed", "publisher-review"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string" || controlCharacters.test(value)) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= minimum && normalized.length <= maximum ? normalized : null;
}

function readString(record: Record<string, unknown>, key: string, minimum = 1, maximum = 1_000) {
  const value = normalizeText(record[key], minimum, maximum);
  if (!value) throw new Error(`Invalid ${key}.`);
  return value;
}

function readTimestamp(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${key}.`);
  return value;
}

function readPositiveInteger(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`Invalid ${key}.`);
  return value as number;
}

function readUuid(record: Record<string, unknown>, key: string) {
  const value = readString(record, key);
  if (!uuidPattern.test(value)) throw new Error(`Invalid ${key}.`);
  return value;
}

function parseQueueItem(value: unknown): CategoryModerationQueueItem {
  if (!isRecord(value) || "reporterUserId" in value || "moderatorUserId" in value) {
    throw new Error("Invalid moderation report.");
  }
  const reason = readString(value, "reason") as CategoryReportReason;
  const status = readString(value, "status") as CategoryReportStatus;
  const availability = readString(value, "availability");
  const categorySlug = readString(value, "categorySlug", 3, 80);
  if (!reasons.has(reason) || !statuses.has(status) || !(availability === "daily" || availability === "practice")) {
    throw new Error("Invalid moderation report.");
  }
  if (!slugPattern.test(categorySlug)) throw new Error("Invalid moderation report.");
  let decision = null;
  if (value.decision !== null) {
    if (!isRecord(value.decision) || "moderatorUserId" in value.decision) throw new Error("Invalid moderation decision.");
    const outcome = readString(value.decision, "outcome") as CategoryModerationOutcome;
    if (!outcomes.has(outcome)) throw new Error("Invalid moderation decision.");
    decision = {
      outcome,
      note: readString(value.decision, "note", 12, 600),
      decidedAt: readTimestamp(value.decision, "decidedAt"),
    };
  }
  if ((status === "pending") !== (decision === null)) throw new Error("Invalid moderation lifecycle.");
  if (decision && (status === "dismissed") !== (decision.outcome === "dismiss")) {
    throw new Error("Invalid moderation lifecycle.");
  }
  return {
    reportId: readUuid(value, "reportId"),
    categorySlug,
    categoryTitle: readString(value, "categoryTitle", 2, 120),
    categoryVersion: readPositiveInteger(value, "categoryVersion"),
    availability,
    reason,
    detail: readString(value, "detail", 20, 800),
    reportedAt: readTimestamp(value, "reportedAt"),
    status,
    decision,
  };
}

export function parseCategoryReportRequest(value: unknown): CategoryReportInput | null {
  if (!isRecord(value)) return null;
  const slug = typeof value.slug === "string" ? value.slug.trim().toLowerCase() : "";
  const reason = value.reason as CategoryReportReason;
  const detail = normalizeText(value.detail, 20, 800);
  if (slug.length < 3 || slug.length > 80 || !slugPattern.test(slug) || !reasons.has(reason) || !detail) {
    return null;
  }
  return { slug, reason, detail };
}

export function parseCategoryReportReceipt(value: unknown): CategoryReportReceipt {
  if (!isRecord(value) || value.status !== "pending") throw new Error("Invalid category report receipt.");
  const slug = readString(value, "categorySlug", 3, 80);
  if (!slugPattern.test(slug)) throw new Error("Invalid category report receipt.");
  return {
    reportId: readUuid(value, "reportId"),
    categorySlug: slug,
    categoryTitle: readString(value, "categoryTitle", 2, 120),
    categoryVersion: readPositiveInteger(value, "categoryVersion"),
    status: "pending",
    submittedAt: readTimestamp(value, "submittedAt"),
  };
}

export function parseCategoryModeratorStatusPayload(value: unknown): CategoryModeratorStatusPayload {
  if (!isRecord(value) || typeof value.authorized !== "boolean") throw new Error("Invalid moderator status.");
  return { serverNow: readTimestamp(value, "serverNow"), authorized: value.authorized };
}

export function parseCategoryModerationQueuePayload(value: unknown): CategoryModerationQueuePayload {
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.reports)) {
    throw new Error("Invalid moderation queue.");
  }
  return {
    serverNow: readTimestamp(value, "serverNow"),
    authorized: true,
    reports: value.reports.map(parseQueueItem),
  };
}

export function parseCategoryModerationDecisionRequest(value: unknown): CategoryModerationDecisionInput | null {
  if (!isRecord(value)) return null;
  const outcome = value.outcome as CategoryModerationOutcome;
  const note = normalizeText(value.note, 12, 600);
  return outcomes.has(outcome) && note ? { outcome, note } : null;
}

export function parseCategoryModerationDecisionPayload(value: unknown): CategoryModerationDecisionPayload {
  if (!isRecord(value)) throw new Error("Invalid moderation decision.");
  const outcome = readString(value, "outcome") as CategoryModerationOutcome;
  const status = readString(value, "status");
  const expectedStatus = outcome === "dismiss" ? "dismissed" : "publisher-review";
  if (!outcomes.has(outcome) || status !== expectedStatus) throw new Error("Invalid moderation decision.");
  return {
    reportId: readUuid(value, "reportId"),
    status: expectedStatus,
    outcome,
    decidedAt: readTimestamp(value, "decidedAt"),
  };
}

export function parseCategoryReportId(value: string): string | null {
  return uuidPattern.test(value) ? value : null;
}
