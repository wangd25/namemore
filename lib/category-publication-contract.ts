import { parseCategoryBankPayload } from "@/lib/category-bank-contract";
import type {
  CategoryPublicationInput,
  CategoryPublicationPayload,
  CategoryPublicationQueuePayload,
  CategoryPublisherStatusPayload,
} from "@/lib/category-publication-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const controlCharacters = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTimestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Invalid timestamp.");
  return value;
}

function readInteger(value: unknown, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error("Invalid publication count.");
  }
  return value;
}

function normalizeText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string" || controlCharacters.test(value)) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= minimum && normalized.length <= maximum ? normalized : null;
}

export function parseCategoryPublisherStatusPayload(value: unknown): CategoryPublisherStatusPayload {
  if (!isRecord(value) || typeof value.authorized !== "boolean") throw new Error("Invalid publisher status.");
  return { serverNow: readTimestamp(value.serverNow), authorized: value.authorized };
}

export function parseCategoryPublicationQueuePayload(value: unknown): CategoryPublicationQueuePayload {
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.banks)) {
    throw new Error("Invalid publication queue.");
  }
  const banks = value.banks.map(parseCategoryBankPayload);
  if (banks.some((bank) => bank.status !== "review-ready"
    || bank.reviewStatus !== "approved"
    || bank.latestReview?.decision !== "approve")) {
    throw new Error("Invalid publication queue.");
  }
  return { serverNow: readTimestamp(value.serverNow), authorized: true, banks };
}

export function parseCategoryPublicationRequest(value: unknown): CategoryPublicationInput | null {
  if (!isRecord(value)) return null;
  const slug = typeof value.slug === "string" ? value.slug.trim().toLowerCase() : "";
  const title = normalizeText(value.title, 2, 120);
  const summary = normalizeText(value.summary, 8, 240);
  const coverageNote = normalizeText(value.coverageNote, 8, 300);
  if (slug.length < 3 || slug.length > 80 || !slugPattern.test(slug)
    || !title || !summary || !coverageNote) return null;
  return { slug, title, summary, coverageNote };
}

export function parseCategoryPublicationPayload(value: unknown): CategoryPublicationPayload {
  if (!isRecord(value)
    || typeof value.publicationId !== "string" || !uuidPattern.test(value.publicationId)
    || typeof value.draftId !== "string" || !uuidPattern.test(value.draftId)
    || typeof value.slug !== "string" || !slugPattern.test(value.slug)
    || value.availability !== "practice" || value.competitiveEligible !== false) {
    throw new Error("Invalid category publication.");
  }
  const bankRevision = readInteger(value.bankRevision, 1);
  const categoryVersion = readInteger(value.categoryVersion, 1);
  const answerCount = readInteger(value.answerCount, 2);
  const acceptedNameCount = readInteger(value.acceptedNameCount, answerCount);
  return {
    publicationId: value.publicationId,
    draftId: value.draftId,
    bankRevision,
    slug: value.slug,
    categoryVersion,
    answerCount,
    acceptedNameCount,
    publishedAt: readTimestamp(value.publishedAt),
    availability: "practice",
    competitiveEligible: false,
  };
}
