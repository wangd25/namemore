import { parseCategoryBankPayload } from "@/lib/category-bank-contract";
import type {
  CategoryPublicationInput,
  CategoryPublicationCorrectionInput,
  CategoryPublicationPayload,
  CategoryPublicationQueuePayload,
  CategoryPublicationRelease,
  CategoryPublisherStatusPayload,
} from "@/lib/category-publication-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!isRecord(value) || value.authorized !== true || !Array.isArray(value.banks)
    || !Array.isArray(value.releases)) {
    throw new Error("Invalid publication queue.");
  }
  const banks = value.banks.map(parseCategoryBankPayload);
  if (banks.some((bank) => bank.status !== "review-ready"
    || bank.reviewStatus !== "approved"
    || bank.latestReview?.decision !== "approve")) {
    throw new Error("Invalid publication queue.");
  }
  return {
    serverNow: readTimestamp(value.serverNow),
    authorized: true,
    banks,
    releases: value.releases.map(parseCategoryPublicationRelease),
  };
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
    || (value.supersededPublicationId !== null
      && (typeof value.supersededPublicationId !== "string" || !uuidPattern.test(value.supersededPublicationId)))
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
    supersededPublicationId: value.supersededPublicationId as string | null,
    availability: "practice",
    competitiveEligible: false,
  };
}

function readBoundedString(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = normalizeText(record[key], minimum, maximum);
  if (!value) throw new Error(`Invalid ${key}.`);
  return value;
}

function readUuidOrNull(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error("Invalid publication link.");
  return value;
}

export function parseCategoryPublicationRelease(value: unknown): CategoryPublicationRelease {
  if (!isRecord(value)
    || typeof value.publicationId !== "string" || !uuidPattern.test(value.publicationId)
    || typeof value.draftId !== "string" || !uuidPattern.test(value.draftId)
    || typeof value.slug !== "string" || !slugPattern.test(value.slug)
    || typeof value.current !== "boolean"
    || value.availability !== "practice" || value.competitiveEligible !== false) {
    throw new Error("Invalid category release.");
  }
  const snapshotDate = readBoundedString(value, "snapshotDate", 10, 10);
  if (!datePattern.test(snapshotDate) || Number.isNaN(Date.parse(`${snapshotDate}T00:00:00Z`))) {
    throw new Error("Invalid category release date.");
  }
  let correctionRequest = null;
  if (value.correctionRequest !== null) {
    if (!isRecord(value.correctionRequest)
      || typeof value.correctionRequest.requestId !== "string"
      || !uuidPattern.test(value.correctionRequest.requestId)
      || typeof value.correctionRequest.revisionStarted !== "boolean"
      || typeof value.correctionRequest.successorPublished !== "boolean") {
      throw new Error("Invalid publication correction.");
    }
    correctionRequest = {
      requestId: value.correctionRequest.requestId,
      reason: readBoundedString(value.correctionRequest, "reason", 12, 1000),
      requestedAt: readTimestamp(value.correctionRequest.requestedAt),
      revisionStarted: value.correctionRequest.revisionStarted,
      successorPublished: value.correctionRequest.successorPublished,
    };
  }
  const bankRevision = readInteger(value.bankRevision, 1);
  const categoryVersion = readInteger(value.categoryVersion, 1);
  const answerCount = readInteger(value.answerCount, 2);
  return {
    publicationId: value.publicationId,
    draftId: value.draftId,
    bankRevision,
    slug: value.slug,
    title: readBoundedString(value, "title", 2, 120),
    prompt: readBoundedString(value, "prompt", 4, 160),
    summary: readBoundedString(value, "summary", 8, 240),
    coverageNote: readBoundedString(value, "coverageNote", 8, 300),
    categoryVersion,
    snapshotDate,
    timeLimitSeconds: readInteger(value.timeLimitSeconds, 10),
    sourceLabel: readBoundedString(value, "sourceLabel", 3, 160),
    sourceUrl: readBoundedString(value, "sourceUrl", 12, 500),
    versionNote: readBoundedString(value, "versionNote", 8, 500),
    answerCount,
    acceptedNameCount: readInteger(value.acceptedNameCount, answerCount),
    publishedAt: readTimestamp(value.publishedAt),
    current: value.current,
    supersedesPublicationId: readUuidOrNull(value.supersedesPublicationId),
    supersededByPublicationId: readUuidOrNull(value.supersededByPublicationId),
    availability: "practice",
    competitiveEligible: false,
    correctionRequest,
  };
}

export function parseCategoryPublicationCorrectionRequest(value: unknown): CategoryPublicationCorrectionInput | null {
  if (!isRecord(value)) return null;
  const reason = normalizeText(value.reason, 12, 1000);
  return reason ? { reason } : null;
}
