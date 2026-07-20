import type { CSSProperties } from "react";

import type { Category, CategoryAnswer } from "@/lib/category-types";
import type { PracticeStats } from "@/lib/practice-game";

type GameResultsProps = {
  category: Category;
  stats: PracticeStats;
  personalBest: number;
  isNewPersonalBest: boolean;
  shareStatus: "idle" | "copied" | "shared" | "error";
  onPlayAgain: () => void;
  onShare: () => void;
};

function CheckIcon() {
  return (
    <svg className="result-check" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4.5 10.1 3.3 3.3 7.7-8" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="action-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 13.8V3.5m0 0L6.7 6.8M10 3.5l3.3 3.3M4.2 9.8v5.7h11.6V9.8" />
    </svg>
  );
}

function formatElapsed(seconds: number): string {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getAnswerAccentStyle(answer: CategoryAnswer): CSSProperties {
  return {
    "--team-primary": answer.visual?.primaryColor ?? "#1463ff",
    "--team-secondary": answer.visual?.secondaryColor ?? "#dbe6ff",
  } as CSSProperties;
}

function formatDuration(milliseconds: number | null): string {
  return milliseconds === null ? "—" : `${(milliseconds / 1_000).toFixed(1)}s`;
}

function getShareMessage(
  shareStatus: GameResultsProps["shareStatus"],
): string {
  switch (shareStatus) {
    case "copied":
      return "Result copied";
    case "shared":
      return "Result shared";
    case "error":
      return "Couldn’t share this time";
    case "idle":
      return "Share a spoiler-free score";
  }
}

export function GameResults({
  category,
  stats,
  personalBest,
  isNewPersonalBest,
  shareStatus,
  onPlayAgain,
  onShare,
}: GameResultsProps) {
  const coverage = stats.coverage;
  const representedGroups = new Set(coverage?.representedGroupIds ?? []);

  return (
    <main className="results-layout" aria-labelledby="game-prompt">
      <section className="results-summary" aria-label="Round summary">
        <div className="result-score-lockup">
          <strong>{stats.answerCount}</strong>
          <span>{stats.answerCount === 1 ? "name" : "names"}</span>
        </div>

        <p className={`best-result${isNewPersonalBest ? " is-new" : ""}`}>
          <span aria-hidden="true">★</span>
          {isNewPersonalBest ? "New local best" : `Local best ${personalBest}`}
        </p>

        <div className="result-rate">
          <strong>{stats.answersPerMinute.toFixed(1)}</strong>
          <span>answers / min</span>
        </div>

        <dl className="result-metrics">
          <div>
            <dt>Fastest gap</dt>
            <dd>{formatDuration(stats.fastestGapMs)}</dd>
          </div>
          <div>
            <dt>Longest pause</dt>
            <dd>{formatDuration(stats.longestPauseMs)}</dd>
          </div>
          <div>
            <dt>Duplicates</dt>
            <dd>{stats.duplicateCount}</dd>
          </div>
          <div>
            <dt>{coverage?.itemLabel ?? "Coverage"}</dt>
            <dd>{coverage ? <><span>{coverage.representedGroupIds.length}</span> / {coverage.groups.length}</> : "—"}</dd>
          </div>
        </dl>

        <div className="result-actions">
          <button className="replay-button" type="button" onClick={onPlayAgain}>
            Play again
          </button>
          <button className="share-button" type="button" onClick={onShare}>
            <ShareIcon />
            Share result
          </button>
        </div>

        <p
          className={`share-status is-${shareStatus}`}
          role="status"
          aria-live="polite"
        >
          {shareStatus === "copied" || shareStatus === "shared" ? (
            <CheckIcon />
          ) : null}
          {getShareMessage(shareStatus)}
        </p>
      </section>

      <section className="results-sheet practice-results-sheet" aria-label="Detailed round results">
        <div className="result-timeline-panel">
          <div className="results-section-heading">
            <h2>Accepted names</h2>
            <span>Timeline</span>
          </div>

          {stats.timeline.length > 0 ? (
            <ol className="result-timeline">
              {stats.timeline.map((entry, index) => (
                <li key={entry.answer.id}>
                  <span className="timeline-index">{index + 1}</span>
                  <time dateTime={`PT${entry.elapsedSeconds}S`}>
                    {formatElapsed(entry.elapsedSeconds)}
                  </time>
                  <CheckIcon />
                  <strong>{entry.answer.canonicalText}</strong>
                  {entry.answer.visual ? (
                    <span
                      className="answer-icon-slot result-answer-visual"
                      aria-label={entry.answer.visual.accessibleLabel}
                      style={getAnswerAccentStyle(entry.answer)}
                    >
                      {entry.answer.visual.label}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-result">No names landed this round.</p>
          )}
        </div>

        {coverage ? (
          <div className="team-coverage-panel coverage-panel">
            <div className="results-section-heading">
              <h2>{coverage.title}</h2>
              <span>{coverage.representedGroupIds.length} / {coverage.groups.length}</span>
            </div>

            <ul className="team-coverage-grid coverage-grid" aria-label={coverage.title}>
              {coverage.groups.map((group) => {
                const isRepresented = representedGroups.has(group.id);

                return (
                  <li
                    className={isRepresented ? "is-covered" : "is-missed"}
                    key={group.id}
                  >
                    <span>{group.label}</span>
                    <span className="sr-only">
                      {isRepresented ? "represented" : "missed"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="missed-team-copy">
              <strong>Missed</strong>
              {coverage.missedGroupIds.length > 0
                ? coverage.groups
                    .filter((group) => coverage.missedGroupIds.includes(group.id))
                    .map((group) => group.label)
                    .join(" · ")
                : "None — complete coverage"}
            </p>
          </div>
        ) : null}
      </section>

      <h1 className="sr-only" id="game-prompt">
        Round complete — {category.prompt}
      </h1>
    </main>
  );
}
