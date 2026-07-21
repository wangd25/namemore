export type CategoryBankAnswer = {
  canonicalText: string;
  aliases: string[];
};

export type CategoryBankStatus = "editing" | "review-ready";
export type CategoryBankReviewStatus = "unreviewed" | "pending" | "changes-requested" | "approved" | "rejected";
export type CategoryBankReviewDecision = "request-correction" | "reject" | "approve";

export type CategoryBankLatestReview = {
  decision: CategoryBankReviewDecision;
  note: string;
  revision: number;
  decidedAt: string;
};

export type CategoryBankPayload = {
  draftId: string;
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
  revision: number;
  status: CategoryBankStatus;
  reviewStatus: CategoryBankReviewStatus;
  snapshotDate: string | null;
  timeLimitSeconds: number | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  versionNote: string | null;
  competitiveEligible: false;
  updatedAt: string;
  submittedAt: string | null;
  latestReview: CategoryBankLatestReview | null;
  answers: CategoryBankAnswer[];
};

export type CategoryBankQueueItem = {
  draftId: string;
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
  revision: number;
  status: "not-started" | CategoryBankStatus;
  available: boolean;
  publicationCorrection: {
    requestId: string;
    publicationId: string;
    slug: string;
    categoryVersion: number;
    reason: string;
    requestedAt: string;
  } | null;
  bank: CategoryBankPayload | null;
};

export type CategoryBankQueuePayload = {
  serverNow: string;
  authorized: boolean;
  drafts: CategoryBankQueueItem[];
};

export type CategoryBankSaveInput = {
  snapshotDate: string;
  timeLimitSeconds: number;
  sourceLabel: string;
  sourceUrl: string;
  versionNote: string;
  answers: CategoryBankAnswer[];
};

export type CategoryBankTextValidation = {
  answers: CategoryBankAnswer[];
  canonicalCount: number;
  aliasCount: number;
  errors: string[];
};
