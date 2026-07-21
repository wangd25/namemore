export type CategoryReviewStatus = "reviewed" | "in-review";

export type CategoryAvailability = "daily" | "practice" | "practice-planned";

export type CategoryDiscoveryEntry = {
  slug: string;
  version: number | null;
  title: string;
  prompt: string;
  summary: string;
  reviewStatus: CategoryReviewStatus;
  availability: CategoryAvailability;
  competitiveEligible: boolean;
  answerCount: number | null;
  sourceLabel: string;
  coverageNote: string;
};

export type TodayBestAmbient = {
  score: number;
  categoryTitle: string;
};

export type PopularCategoryAmbient = {
  categoryTitle: string;
  verifiedRoundCount: number;
};

export type LiveRoomsAmbient = {
  roomCount: number;
};

export type CategoryDiscoveryPayload = {
  serverNow: string;
  categories: CategoryDiscoveryEntry[];
  ambient: {
    todayBest: TodayBestAmbient | null;
    popularCategory: PopularCategoryAmbient | null;
    liveRooms: LiveRoomsAmbient | null;
  };
};

export type CategoryDraftStatus = "draft" | "review-requested" | "review-complete";

export type CategoryDraftReviewStatus =
  | "unreviewed"
  | "changes-requested"
  | "pending"
  | "scope-approved"
  | "rejected";

export type CategoryDraftReviewDecision =
  | "request-changes"
  | "reject"
  | "scope-approve";

export type CategoryDraftLatestReview = {
  decision: CategoryDraftReviewDecision;
  note: string;
  revision: number;
  decidedAt: string;
};

export type CategoryDraftPayload = {
  id: string;
  prompt: string;
  sourceNotes: string;
  coverageNotes: string;
  status: CategoryDraftStatus;
  reviewStatus: CategoryDraftReviewStatus;
  reviewRevision: number;
  latestReview: CategoryDraftLatestReview | null;
  competitiveEligible: false;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

export type CategoryDraftListPayload = {
  serverNow: string;
  drafts: CategoryDraftPayload[];
};
