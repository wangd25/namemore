import { parseCategoryBankPayload } from "@/lib/category-bank-contract";
import type {
  CategoryBankDecisionInput,
  CategoryBankDecisionPayload,
  CategoryBankReviewQueuePayload,
} from "@/lib/category-bank-review-types";
import type { CategoryBankReviewDecision } from "@/lib/category-bank-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const decisions = new Set<CategoryBankReviewDecision>(["request-correction", "reject", "approve"]);
const resultingStatuses = {
  "request-correction": "changes-requested",
  reject: "rejected",
  approve: "approved",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTimestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Invalid timestamp.");
  return value;
}

export function parseCategoryBankReviewQueuePayload(value: unknown): CategoryBankReviewQueuePayload {
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.banks)) {
    throw new Error("Invalid answer-bank review queue.");
  }
  const banks = value.banks.map(parseCategoryBankPayload);
  if (banks.some((bank) => bank.status !== "review-ready" || bank.reviewStatus !== "pending" || bank.latestReview !== null)) {
    throw new Error("Invalid answer-bank review queue.");
  }
  return { serverNow: readTimestamp(value.serverNow), authorized: true, banks };
}

export function parseCategoryBankDecisionRequest(value: unknown): CategoryBankDecisionInput | null {
  if (!isRecord(value) || typeof value.decision !== "string" || !decisions.has(value.decision as CategoryBankReviewDecision)
    || typeof value.note !== "string" || controlCharacters.test(value.note)) return null;
  const note = value.note.trim().replace(/\s+/g, " ");
  if (note.length < 12 || note.length > 600) return null;
  return { decision: value.decision as CategoryBankReviewDecision, note };
}

export function parseCategoryBankDecisionPayload(value: unknown): CategoryBankDecisionPayload {
  if (!isRecord(value) || value.competitiveEligible !== false || typeof value.draftId !== "string"
    || !uuidPattern.test(value.draftId) || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision)
    || value.revision < 1 || typeof value.decision !== "string"
    || !decisions.has(value.decision as CategoryBankReviewDecision)) {
    throw new Error("Invalid answer-bank decision.");
  }
  const decision = value.decision as CategoryBankReviewDecision;
  const reviewStatus = resultingStatuses[decision];
  if (value.reviewStatus !== reviewStatus) throw new Error("Invalid answer-bank decision.");
  return {
    draftId: value.draftId,
    revision: value.revision,
    decision,
    reviewStatus,
    decidedAt: readTimestamp(value.decidedAt),
    competitiveEligible: false,
  };
}
