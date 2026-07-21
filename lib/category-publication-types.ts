import type { CategoryBankPayload } from "@/lib/category-bank-types";

export type CategoryPublisherStatusPayload = {
  serverNow: string;
  authorized: boolean;
};

export type CategoryPublicationQueuePayload = CategoryPublisherStatusPayload & {
  banks: CategoryBankPayload[];
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
  availability: "practice";
  competitiveEligible: false;
};
