export type CategoryReportReason =
  | "answer-bank-accuracy"
  | "coverage-or-wording"
  | "provenance-or-copyright"
  | "offensive-or-unsafe"
  | "other";

export type CategoryReportStatus = "pending" | "dismissed" | "publisher-review";

export type CategoryModerationOutcome = "dismiss" | "publisher-review";

export type CategoryReportInput = {
  slug: string;
  reason: CategoryReportReason;
  detail: string;
};

export type CategoryReportReceipt = {
  reportId: string;
  categorySlug: string;
  categoryTitle: string;
  categoryVersion: number;
  status: "pending";
  submittedAt: string;
};

export type CategoryModerationDecision = {
  outcome: CategoryModerationOutcome;
  note: string;
  decidedAt: string;
};

export type CategoryModerationQueueItem = {
  reportId: string;
  categorySlug: string;
  categoryTitle: string;
  categoryVersion: number;
  availability: "daily" | "practice";
  reason: CategoryReportReason;
  detail: string;
  reportedAt: string;
  status: CategoryReportStatus;
  decision: CategoryModerationDecision | null;
};

export type CategoryModeratorStatusPayload = {
  serverNow: string;
  authorized: boolean;
};

export type CategoryModerationQueuePayload = CategoryModeratorStatusPayload & {
  reports: CategoryModerationQueueItem[];
};

export type CategoryModerationDecisionInput = {
  outcome: CategoryModerationOutcome;
  note: string;
};

export type CategoryModerationDecisionPayload = {
  reportId: string;
  status: "dismissed" | "publisher-review";
  outcome: CategoryModerationOutcome;
  decidedAt: string;
};
