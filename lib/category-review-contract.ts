import type {
  CategoryReviewDecisionPayload,
  CategoryReviewerStatusPayload,
  CategoryReviewQueueItem,
  CategoryReviewQueuePayload,
} from "@/lib/category-review-types";
import type { CategoryDraftReviewDecision } from "@/lib/category-discovery-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const decisions = new Set<CategoryDraftReviewDecision>([
  "request-changes",
  "reject",
  "scope-approve",
]);

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

function parseQueueItem(value: unknown): CategoryReviewQueueItem {
  if (!isRecord(value)) throw new Error("Invalid review queue item.");
  const id = readString(value, "id");
  if (!uuidPattern.test(id)) throw new Error("Invalid review queue item.");
  return {
    id,
    prompt: readString(value, "prompt"),
    sourceNotes: readString(value, "sourceNotes"),
    coverageNotes: readString(value, "coverageNotes"),
    submittedAt: readTimestamp(value, "submittedAt"),
    reviewRevision: readPositiveInteger(value, "reviewRevision"),
  };
}

export function parseCategoryReviewerStatusPayload(value: unknown): CategoryReviewerStatusPayload {
  if (!isRecord(value) || typeof value.authorized !== "boolean") {
    throw new Error("Invalid reviewer status payload.");
  }
  return { serverNow: readTimestamp(value, "serverNow"), authorized: value.authorized };
}

export function parseCategoryReviewQueuePayload(value: unknown): CategoryReviewQueuePayload {
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.drafts)) {
    throw new Error("Invalid review queue payload.");
  }
  return {
    serverNow: readTimestamp(value, "serverNow"),
    authorized: true,
    drafts: value.drafts.map(parseQueueItem),
  };
}

export function parseCategoryReviewDecisionPayload(value: unknown): CategoryReviewDecisionPayload {
  if (!isRecord(value)) throw new Error("Invalid review decision payload.");
  const draftId = readString(value, "draftId");
  const decision = readString(value, "decision");
  const reviewStatus = readString(value, "reviewStatus");
  const expectedStatus = decision === "request-changes"
    ? "changes-requested"
    : decision === "reject"
      ? "rejected"
      : "scope-approved";
  if (!uuidPattern.test(draftId) || !decisions.has(decision as CategoryDraftReviewDecision) || reviewStatus !== expectedStatus) {
    throw new Error("Invalid review decision payload.");
  }
  return {
    draftId,
    decision: decision as CategoryDraftReviewDecision,
    reviewStatus: expectedStatus,
    reviewRevision: readPositiveInteger(value, "reviewRevision"),
    decidedAt: readTimestamp(value, "decidedAt"),
  };
}

export function parseCategoryReviewDecisionRequest(value: unknown): {
  decision: CategoryDraftReviewDecision;
  note: string;
} | null {
  if (!isRecord(value) || typeof value.decision !== "string" || typeof value.note !== "string") return null;
  if (!decisions.has(value.decision as CategoryDraftReviewDecision) || controlCharacters.test(value.note)) return null;
  const note = value.note.trim().replace(/\s+/g, " ");
  if (note.length < 12 || note.length > 600) return null;
  return { decision: value.decision as CategoryDraftReviewDecision, note };
}
