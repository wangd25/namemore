import { DailyLeaderboard } from "@/components/DailyLeaderboard";
import { nbaTeamCodes } from "@/lib/category-types";
import type {
  DailyCategoryMetadata,
  DailyLeaderboardPayload,
} from "@/lib/daily-types";
import type { PracticeStats } from "@/lib/practice-game";

type DailyGameResultsProps = {
  category: DailyCategoryMetadata;
  stats: PracticeStats;
  shareStatus: "idle" | "copied" | "shared" | "error";
  leaderboard: DailyLeaderboardPayload | null;
  leaderboardState: "loading" | "ready" | "error";
  onRefresh: () => void;
  onRetryLeaderboard: () => void;
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
  return `${String(Math.floor(wholeSeconds / 60)).padStart(2, "0")}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function formatDuration(milliseconds: number | null): string {
  return milliseconds === null ? "—" : `${(milliseconds / 1_000).toFixed(1)}s`;
}

function shareMessage(status: DailyGameResultsProps["shareStatus"]): string {
  if (status === "copied") return "Result copied";
  if (status === "shared") return "Result shared";
  if (status === "error") return "Couldn’t share this time";
  return "Share a spoiler-free verified score";
}

export function DailyGameResults({
  category,
  stats,
  shareStatus,
  leaderboard,
  leaderboardState,
  onRefresh,
  onRetryLeaderboard,
  onShare,
}: DailyGameResultsProps) {
  const representedTeams = new Set(stats.representedTeamCodes);

  return (
    <main className="results-layout" aria-labelledby="game-prompt">
      <section className="results-summary" aria-label="Verified round summary">
        <div className="result-score-lockup">
          <strong>{stats.answerCount}</strong>
          <span>{stats.answerCount === 1 ? "name" : "names"}</span>
        </div>

        <p className="best-result is-new">
          <CheckIcon />
          Verified daily result
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
            <dd><span>{stats.representedTeamCodes.length}</span> / 30</dd>
          </div>
        </dl>

        <div className="result-actions">
          <button className="replay-button" type="button" onClick={onRefresh}>
            Refresh result
          </button>
          <button className="share-button" type="button" onClick={onShare}>
            <ShareIcon />
            Share result
          </button>
        </div>

        <p className={`share-status is-${shareStatus}`} role="status" aria-live="polite">
          {shareStatus === "copied" || shareStatus === "shared" ? <CheckIcon /> : null}
          {shareMessage(shareStatus)}
        </p>
      </section>

      <section className="results-sheet" aria-label="Detailed verified results">
        <div className="result-timeline-panel">
          <div className="results-section-heading">
            <h2>Accepted names</h2>
            <span>Server timeline</span>
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
            {nbaTeamCodes.map((teamCode) => (
              <li className={representedTeams.has(teamCode) ? "is-covered" : "is-missed"} key={teamCode}>
                <span>{teamCode}</span>
                <span className="sr-only">
                  {representedTeams.has(teamCode) ? "represented" : "missed"}
                </span>
              </li>
            ))}
          </ul>
          <p className="missed-team-copy">
            <strong>Missed</strong>
            {stats.missedTeamCodes.length > 0
              ? stats.missedTeamCodes.join(" · ")
              : "None — complete league coverage"}
          </p>
        </div>

        <DailyLeaderboard
          leaderboard={leaderboard}
          state={leaderboardState}
          onRetry={onRetryLeaderboard}
        />
      </section>

      <h1 className="sr-only" id="game-prompt">
        Verified round complete — {category.prompt}
      </h1>
    </main>
  );
}
