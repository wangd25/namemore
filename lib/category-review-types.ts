import type { CategoryDraftReviewDecision } from "@/lib/category-discovery-types";

export type CategoryReviewQueueItem = {
  id: string;
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
  submittedAt: string;
  reviewRevision: number;
};

export type CategoryReviewerStatusPayload = {
  serverNow: string;
  authorized: boolean;
};

export type CategoryReviewQueuePayload = CategoryReviewerStatusPayload & {
  drafts: CategoryReviewQueueItem[];
};

export type CategoryReviewDecisionPayload = {
  draftId: string;
  decision: CategoryDraftReviewDecision;
  reviewStatus: "changes-requested" | "scope-approved" | "rejected";
  reviewRevision: number;
  decidedAt: string;
};
