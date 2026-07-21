import type {
  CategoryBankPayload,
  CategoryBankReviewDecision,
  CategoryBankReviewStatus,
} from "@/lib/category-bank-types";

export type CategoryBankReviewQueuePayload = {
  serverNow: string;
  authorized: boolean;
  banks: CategoryBankPayload[];
};

export type CategoryBankDecisionInput = {
  decision: CategoryBankReviewDecision;
  note: string;
};

export type CategoryBankDecisionPayload = {
  draftId: string;
  revision: number;
  decision: CategoryBankReviewDecision;
  reviewStatus: Exclude<CategoryBankReviewStatus, "unreviewed" | "pending">;
  decidedAt: string;
  competitiveEligible: false;
};
