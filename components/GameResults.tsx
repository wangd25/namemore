import { nbaTeamCodes, type Category } from "@/lib/category-types";
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
  const representedTeams = new Set(stats.representedTeamCodes);

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
            <dt>Teams</dt>
            <dd>
              <span>{stats.representedTeamCodes.length}</span> / 30
            </dd>
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

      <section className="results-sheet" aria-label="Detailed round results">
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
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-result">No names landed this round.</p>
          )}
        </div>

        <div className="team-coverage-panel">
          <div className="results-section-heading">
            <h2>Team coverage</h2>
            <span>{stats.representedTeamCodes.length} / 30</span>
          </div>

          <ul className="team-coverage-grid" aria-label="NBA team coverage">
            {nbaTeamCodes.map((teamCode) => {
              const isRepresented = representedTeams.has(teamCode);

              return (
                <li
                  className={isRepresented ? "is-covered" : "is-missed"}
                  key={teamCode}
                >
                  <span>{teamCode}</span>
                  <span className="sr-only">
                    {isRepresented ? "represented" : "missed"}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="missed-team-copy">
            <strong>Missed</strong>
            {stats.missedTeamCodes.length > 0
              ? stats.missedTeamCodes.join(" · ")
              : "None — complete league coverage"}
          </p>
        </div>
      </section>

      <h1 className="sr-only" id="game-prompt">
        Round complete — {category.prompt}
      </h1>
    </main>
  );
}
