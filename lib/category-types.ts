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

export type CategoryAnswer = {
  id: string;
  canonicalText: string;
  aliases: readonly string[];
  teamCode: NbaTeamCode;
};

export type Category = {
  slug: string;
  version: number;
  snapshotDate: string;
  title: string;
  prompt: string;
  timeLimitSeconds: number;
  answers: readonly CategoryAnswer[];
};

export type AnswerSubmissionResult =
  | { status: "accepted"; answer: CategoryAnswer; score: number }
  | { status: "duplicate"; answer: CategoryAnswer }
  | { status: "invalid" }
  | { status: "round-ended" };
