import Link from "next/link";

import type { RoomGame } from "@/lib/room-types";

function CheckIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.1 3.3 3.3 7.7-8" /></svg>;
}

export function RoomResults({ game }: { game: RoomGame }) {
  const isElimination = game.mode === "elimination";
  return (
    <section className="game-board room-board room-results-board" aria-labelledby="room-results-title">
      <header className="board-header">
        <Link className="brand" href="/">NameMore</Link>
        <div className="room-header-code"><span>Room</span><strong>{game.code}</strong></div>
      </header>

      <main className="room-results-content">
        <div className="room-results-heading">
          <h1 id="room-results-title">Round complete</h1>
          <p>{isElimination ? "Every claimed answer is now revealed." : "All answers are now revealed."}</p>
        </div>

        <ol className="room-rank-rail" aria-label="Private room results">
          {game.players.map((player) => (
            <li className={player.rank === 1 ? "is-winner" : ""} key={player.id}>
              <span className="room-result-rank">{player.rank}</span>
              <strong>{player.id === game.membership.playerId ? "You" : player.displayName}</strong>
              <span className="room-result-score">{player.score}</span>
              {player.isTied ? <small>Tied score</small> : null}
            </li>
          ))}
        </ol>

        <div className="room-reveal-grid">
          {game.players.map((player) => (
            <section className="room-reveal-column" key={player.id} aria-labelledby={`answers-${player.id}`}>
              <header>
                <h2 id={`answers-${player.id}`}>{player.id === game.membership.playerId ? (isElimination ? "Your claims" : "Your answers") : `${player.displayName}’s ${isElimination ? "claims" : "answers"}`}</h2>
                <span>{player.score} {isElimination ? "claimed" : "accepted"}</span>
              </header>
              {player.answers && player.answers.length > 0 ? (
                <ol>
                  {player.answers.map((answer) => (
                    <li key={answer.id}><span><CheckIcon /></span>{answer.canonicalText}</li>
                  ))}
                </ol>
              ) : <p>No accepted answers.</p>}
            </section>
          ))}
        </div>

        <div className="room-results-actions">
          <Link className="room-primary-action" href="/room">Play again</Link>
          <Link className="room-secondary-action" href="/">Back home</Link>
        </div>
      </main>

      <footer className="board-footer"><span>{isElimination ? "Elimination" : "Private race"} result · server verified</span></footer>
    </section>
  );
}
