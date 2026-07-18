import type { DailyLeaderboardPayload } from "@/lib/daily-types";

type DailyLeaderboardProps = {
  leaderboard: DailyLeaderboardPayload | null;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
};

export function DailyLeaderboard({
  leaderboard,
  state,
  onRetry,
}: DailyLeaderboardProps) {
  return (
    <section
      className="leaderboard-panel"
      aria-labelledby="leaderboard-heading"
      aria-busy={state === "loading"}
    >
      <div className="results-section-heading">
        <h2 id="leaderboard-heading">Today’s top ten</h2>
        <span>Verified only</span>
      </div>

      {state === "loading" ? (
        <p className="leaderboard-message" role="status">
          Loading verified finishes…
        </p>
      ) : state === "error" ? (
        <div className="leaderboard-message is-error">
          <p>The leaderboard couldn’t load. Your result is still verified.</p>
          <button type="button" onClick={onRetry}>Retry leaderboard</button>
        </div>
      ) : !leaderboard?.challenge ? (
        <p className="leaderboard-message">No leaderboard is available for this UTC challenge.</p>
      ) : leaderboard.entries.length === 0 ? (
        <p className="leaderboard-message">
          No verified finishers yet. Active rounds never appear here.
        </p>
      ) : (
        <ol className="leaderboard-list">
          {leaderboard.entries.map((entry) => (
            <li key={`${entry.rank}-${entry.displayName}`}>
              <span className="leaderboard-rank">{entry.rank}</span>
              <strong>{entry.displayName}</strong>
              {entry.isTied ? <span className="leaderboard-tie">tied score</span> : null}
              <span className="leaderboard-score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="leaderboard-rule">
        Equal scores are marked tied. Earlier verified completion, then earlier attempt creation,
        sets the displayed position.
      </p>
    </section>
  );
}
