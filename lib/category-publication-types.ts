import type { CategoryBankPayload } from "@/lib/category-bank-types";
import type { CategoryReportReason } from "@/lib/category-moderation-types";

export type CategoryPublisherStatusPayload = {
  serverNow: string;
  authorized: boolean;
};

export type CategoryPublicationQueuePayload = CategoryPublisherStatusPayload & {
  banks: CategoryBankPayload[];
  releases: CategoryPublicationRelease[];
};

export type CategoryPublicationInput = {
  slug: string;
  title: string;
  summary: string;
  coverageNote: string;
};

export type CategoryPublicationPayload = {
  publicationId: string;
  draftId: string;
  bankRevision: number;
  slug: string;
  categoryVersion: number;
  answerCount: number;
  acceptedNameCount: number;
  publishedAt: string;
  supersededPublicationId: string | null;
  availability: "practice";
  competitiveEligible: false;
};

export type CategoryPublicationCorrection = {
  requestId: string;
  reason: string;
  requestedAt: string;
  revisionStarted: boolean;
  successorPublished: boolean;
};

export type CategoryPublicationModerationEscalation = {
  reportId: string;
  reason: CategoryReportReason;
  summary: string;
  decidedAt: string;
};

export type CategoryPublicationRelease = {
  publicationId: string;
  draftId: string;
  bankRevision: number;
  slug: string;
  title: string;
  prompt: string;
  summary: string;
  coverageNote: string;
  categoryVersion: number;
  snapshotDate: string;
  timeLimitSeconds: number;
  sourceLabel: string;
  sourceUrl: string;
  versionNote: string;
  answerCount: number;
  acceptedNameCount: number;
  publishedAt: string;
  current: boolean;
  supersedesPublicationId: string | null;
  supersededByPublicationId: string | null;
  availability: "practice";
  competitiveEligible: false;
  correctionRequest: CategoryPublicationCorrection | null;
  moderationEscalation: CategoryPublicationModerationEscalation | null;
};

export type CategoryPublicationCorrectionInput = {
  reason: string;
};
