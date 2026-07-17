import type {
  AnswerSubmissionResult,
  CategoryAnswer,
} from "@/lib/category-types";
import {
  getSurname,
  normalizeAnswer,
  withoutNameSuffix,
} from "@/lib/normalize";

export type AnswerLookup = ReadonlyMap<string, CategoryAnswer>;

function addAlias(
  lookup: Map<string, CategoryAnswer>,
  rawAlias: string,
  answer: CategoryAnswer,
): void {
  const alias = normalizeAnswer(rawAlias);

  if (!alias) {
    throw new Error(`Answer ${answer.id} contains an empty alias.`);
  }

  const existingAnswer = lookup.get(alias);

  if (existingAnswer && existingAnswer.id !== answer.id) {
    throw new Error(
      `Alias collision: "${rawAlias}" maps to both ${existingAnswer.id} and ${answer.id}.`,
    );
  }

  lookup.set(alias, answer);
}

export function buildAnswerLookup(
  answers: readonly CategoryAnswer[],
): AnswerLookup {
  const lookup = new Map<string, CategoryAnswer>();
  const surnameCounts = new Map<string, number>();

  for (const answer of answers) {
    const surname = getSurname(answer.canonicalText);
    surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
  }

  for (const answer of answers) {
    addAlias(lookup, answer.canonicalText, answer);

    const suffixlessName = withoutNameSuffix(answer.canonicalText);
    if (suffixlessName !== normalizeAnswer(answer.canonicalText)) {
      addAlias(lookup, suffixlessName, answer);
    }

    for (const alias of answer.aliases) {
      addAlias(lookup, alias, answer);
    }

    const surname = getSurname(answer.canonicalText);
    if (surnameCounts.get(surname) === 1) {
      addAlias(lookup, surname, answer);
    }
  }

  return lookup;
}

export function matchAnswer(
  rawAnswer: string,
  lookup: AnswerLookup,
): CategoryAnswer | null {
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  return normalizedAnswer ? (lookup.get(normalizedAnswer) ?? null) : null;
}

export function shouldDelayAutomaticMatch(
  rawAnswer: string,
  lookup: AnswerLookup,
): boolean {
  const normalizedAnswer = normalizeAnswer(rawAnswer);
  const matchedAnswer = normalizedAnswer
    ? (lookup.get(normalizedAnswer) ?? null)
    : null;

  if (!normalizedAnswer || !matchedAnswer) {
    return false;
  }

  for (const [candidate, candidateAnswer] of lookup) {
    if (
      candidateAnswer.id !== matchedAnswer.id &&
      candidate.startsWith(normalizedAnswer)
    ) {
      return true;
    }
  }

  return false;
}

export function evaluateAnswerSubmission(
  rawAnswer: string,
  lookup: AnswerLookup,
  acceptedAnswerIds: ReadonlySet<string>,
  hasRoundEnded: boolean,
): AnswerSubmissionResult {
  if (hasRoundEnded) {
    return { status: "round-ended" };
  }

  const answer = matchAnswer(rawAnswer, lookup);

  if (!answer) {
    return { status: "invalid" };
  }

  if (acceptedAnswerIds.has(answer.id)) {
    return { status: "duplicate", answer };
  }

  return {
    status: "accepted",
    answer,
    score: acceptedAnswerIds.size + 1,
  };
}
