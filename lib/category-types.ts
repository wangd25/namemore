export const nbaTeamCodes = [
  "ATL",
  "BOS",
  "BKN",
  "CHA",
  "CHI",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GSW",
  "HOU",
  "IND",
  "LAC",
  "LAL",
  "MEM",
  "MIA",
  "MIL",
  "MIN",
  "NOP",
  "NYK",
  "OKC",
  "ORL",
  "PHI",
  "PHX",
  "POR",
  "SAC",
  "SAS",
  "TOR",
  "UTA",
  "WAS",
] as const;

export type NbaTeamCode = (typeof nbaTeamCodes)[number];

export type AnswerVisual = {
  kind: "text";
  label: string;
  accessibleLabel: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export type CategoryCoverageGroup = {
  id: string;
  label: string;
};

export type CategoryCoverage = {
  title: string;
  itemLabel: string;
  groups: readonly CategoryCoverageGroup[];
};

export type CategoryAnswer = {
  id: string;
  canonicalText: string;
  aliases: readonly string[];
  visual?: AnswerVisual;
  groupIds?: readonly string[];
  teamCode?: NbaTeamCode;
};

export type Category = {
  slug: string;
  version: number;
  snapshotDate: string;
  title: string;
  prompt: string;
  timeLimitSeconds: number;
  inputLabel: string;
  inputPlaceholder: string;
  sourceLabel: string;
  coverage?: CategoryCoverage;
  answers: readonly CategoryAnswer[];
};

export type AnswerSubmissionResult =
  | { status: "accepted"; answer: CategoryAnswer; score: number }
  | { status: "duplicate"; answer: CategoryAnswer }
  | { status: "invalid" }
  | { status: "round-ended" };
