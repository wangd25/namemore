import {
  nbaTeamCodes,
  type Category,
  type CategoryAnswer,
  type CategoryCoverage,
  type NbaTeamCode,
} from "@/lib/category-types";

export type AcceptedAnswerEvent = {
  answer: CategoryAnswer;
  acceptedAtMs: number;
};

export type PracticeTimelineEntry = AcceptedAnswerEvent & {
  elapsedSeconds: number;
};

export type QuickPairFeedback = {
  gapMs: number;
  message: string;
};

export type PracticeStats = {
  answerCount: number;
  answersPerMinute: number;
  duplicateCount: number;
  fastestGapMs: number | null;
  longestPauseMs: number;
  representedTeamCodes: readonly NbaTeamCode[];
  missedTeamCodes: readonly NbaTeamCode[];
  coverage: {
    title: string;
    itemLabel: string;
    representedGroupIds: readonly string[];
    missedGroupIds: readonly string[];
    groups: CategoryCoverage["groups"];
  } | null;
  timeline: readonly PracticeTimelineEntry[];
};

type StoredBoolean = {
  version: 1;
  enabled: boolean;
};

type StoredScore = {
  version: 1;
  score: number;
};

export const feedbackPreferenceStorageKey = "namemore:feedback:v1";

export function getQuickPairFeedback(
  previousAcceptedAtMs: number,
  acceptedAtMs: number,
): QuickPairFeedback | null {
  const gapMs = acceptedAtMs - previousAcceptedAtMs;

  if (!Number.isFinite(gapMs) || gapMs < 0 || gapMs > 2_500) {
    return null;
  }

  const seconds = (gapMs / 1_000).toFixed(2);

  if (gapMs <= 750) {
    return { gapMs, message: `Two in ${seconds}s. That was filthy.` };
  }

  if (gapMs <= 1_500) {
    return { gapMs, message: `Two in ${seconds}s — damn.` };
  }

  return { gapMs, message: `Two in ${seconds}s. You’re cooking.` };
}

export function getPracticeBestStorageKey(category: Category): string {
  return `namemore:practice-best:v1:${category.slug}:${category.version}`;
}

function parseStoredObject(value: string | null): unknown {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function readPracticeBest(
  storage: Pick<Storage, "getItem">,
  key: string,
): number {
  try {
    const stored = parseStoredObject(storage.getItem(key));

    if (
      typeof stored === "object" &&
      stored !== null &&
      "version" in stored &&
      stored.version === 1 &&
      "score" in stored &&
      typeof stored.score === "number" &&
      Number.isSafeInteger(stored.score) &&
      stored.score >= 0
    ) {
      return stored.score;
    }
  } catch {
    return 0;
  }

  return 0;
}

export function writePracticeBest(
  storage: Pick<Storage, "setItem">,
  key: string,
  score: number,
): boolean {
  if (!Number.isSafeInteger(score) || score < 0) {
    return false;
  }

  try {
    const value: StoredScore = { version: 1, score };
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readFeedbackPreference(
  storage: Pick<Storage, "getItem">,
): boolean {
  try {
    const stored = parseStoredObject(
      storage.getItem(feedbackPreferenceStorageKey),
    );

    if (
      typeof stored === "object" &&
      stored !== null &&
      "version" in stored &&
      stored.version === 1 &&
      "enabled" in stored &&
      typeof stored.enabled === "boolean"
    ) {
      return stored.enabled;
    }
  } catch {
    return true;
  }

  return true;
}

export function writeFeedbackPreference(
  storage: Pick<Storage, "setItem">,
  enabled: boolean,
): boolean {
  try {
    const value: StoredBoolean = { version: 1, enabled };
    storage.setItem(feedbackPreferenceStorageKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function calculatePracticeStats({
  acceptedEvents,
  startedAtMs,
  endedAtMs,
  duplicateCount,
  coverage,
}: {
  acceptedEvents: readonly AcceptedAnswerEvent[];
  startedAtMs: number;
  endedAtMs: number;
  duplicateCount: number;
  coverage?: CategoryCoverage;
}): PracticeStats {
  const safeEndMs = Math.max(startedAtMs, endedAtMs);
  const durationMs = Math.max(1_000, safeEndMs - startedAtMs);
  const representedTeams = new Set<NbaTeamCode>();
  const representedGroups = new Set<string>();
  const timeline: PracticeTimelineEntry[] = [];
  const pauses: number[] = [];
  const answerGaps: number[] = [];
  let previousTime = startedAtMs;

  for (const event of acceptedEvents) {
    const safeAcceptedAtMs = Math.min(
      safeEndMs,
      Math.max(startedAtMs, event.acceptedAtMs),
    );
    const pause = safeAcceptedAtMs - previousTime;

    pauses.push(pause);
    if (timeline.length > 0) {
      answerGaps.push(pause);
    }

    if (event.answer.teamCode) {
      representedTeams.add(event.answer.teamCode);
    }
    for (const groupId of event.answer.groupIds ?? []) {
      representedGroups.add(groupId);
    }
    timeline.push({
      ...event,
      acceptedAtMs: safeAcceptedAtMs,
      elapsedSeconds: (safeAcceptedAtMs - startedAtMs) / 1_000,
    });
    previousTime = safeAcceptedAtMs;
  }

  pauses.push(safeEndMs - previousTime);

  const representedTeamCodes = nbaTeamCodes.filter((teamCode) =>
    representedTeams.has(teamCode),
  );
  const missedTeamCodes = nbaTeamCodes.filter(
    (teamCode) => !representedTeams.has(teamCode),
  );
  const representedCoverageGroups =
    coverage?.groups.filter((group) => representedGroups.has(group.id)) ?? [];
  const missedCoverageGroups =
    coverage?.groups.filter((group) => !representedGroups.has(group.id)) ?? [];

  return {
    answerCount: acceptedEvents.length,
    answersPerMinute: (acceptedEvents.length * 60_000) / durationMs,
    duplicateCount,
    fastestGapMs:
      answerGaps.length > 0 ? Math.min(...answerGaps) : null,
    longestPauseMs: Math.max(...pauses),
    representedTeamCodes,
    missedTeamCodes,
    coverage: coverage
      ? {
          title: coverage.title,
          itemLabel: coverage.itemLabel,
          representedGroupIds: representedCoverageGroups.map((group) => group.id),
          missedGroupIds: missedCoverageGroups.map((group) => group.id),
          groups: coverage.groups,
        }
      : null,
    timeline,
  };
}

export function buildSpoilerFreeShareText({
  categoryTitle,
  score,
  coverageSummary,
}: {
  categoryTitle: string;
  score: number;
  coverageSummary?: {
    represented: number;
    total: number;
    itemLabel: string;
  };
}): string {
  const fiveAnswerDrops = "◆".repeat(Math.floor(score / 5));
  const singleAnswerDrops = "•".repeat(score % 5);
  const scorePattern = `${fiveAnswerDrops}${singleAnswerDrops}` || "—";

  const coverageLine = coverageSummary
    ? ` · ${coverageSummary.represented}/${coverageSummary.total} ${coverageSummary.itemLabel}`
    : "";

  return [
    `NameMore — ${categoryTitle}`,
    `${score} ${score === 1 ? "name" : "names"}${coverageLine}`,
    scorePattern,
    "Local practice · not ranked",
  ].join("\n");
}
