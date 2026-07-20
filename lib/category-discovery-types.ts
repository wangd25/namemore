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

export type CategoryDraftPayload = {
  id: string;
  status: "draft";
  reviewStatus: "unreviewed";
  competitiveEligible: false;
  createdAt: string;
};
