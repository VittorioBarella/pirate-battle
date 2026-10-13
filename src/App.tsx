import { useState } from "react";
import { Game } from "./components/Game";
import { defaultOptions, makeConfig } from "./config/gameConfig";
import type { GameConfig } from "./config/gameConfig";
import type { Match } from "./api/contracts";
import "./styles.css";

export default function App() {
  const [matchConfig, setMatchConfig] = useState<GameConfig | null>(null);
  const [result, setResult] = useState<Match | null>(null);

  const startGame = () => {
    setResult(null);
    setMatchConfig(makeConfig(defaultOptions));
  };

  const finishGame = (match: Match) => {
    setResult(match);
    setMatchConfig(null);
  };

  const openMenu = () => {
    setMatchConfig(null);
    setResult(null);
  };

  if (matchConfig) {
    return (
      <Game
        config={matchConfig}
        name="Captain"
        onFinish={finishGame}
        onExit={openMenu}
      />
    );
  }

  if (result) {
    return (
      <main className="menu-screen">
        <section className="menu-card" aria-labelledby="result-title">
          <small>THE LAST TIDE</small>
          <h1 id="result-title">Battle complete</h1>

          <dl className="result-stats">
            <div>
              <dt>Score</dt>
              <dd>{result.score}</dd>
            </div>

            <div>
              <dt>Time played</dt>
              <dd>{result.duration.toFixed(1)}s</dd>
            </div>

            <div>
              <dt>End reason</dt>
              <dd>
                {result.reason === "death"
                  ? "Your ship was destroyed"
                  : "Time expired"}
              </dd>
            </div>
          </dl>

          <p className="muted">
            Match registration will be available after API integration.
          </p>

          <div className="menu-actions">
            <button onClick={startGame}>Play Again</button>
            <button className="quiet" onClick={openMenu}>
              Main Menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="menu-screen">
      <section className="menu-card" aria-labelledby="menu-title">
        <small>THE LAST TIDE</small>
        <h1 id="menu-title">Pirate Battle</h1>

        <p>
          Navigate the islands, defeat enemy ships and survive the battle.
        </p>

        <button className="play-button" onClick={startGame}>
          Play
        </button>

        <h2>Controls</h2>

        <ul className="controls-list">
          <li>W / ↑ — Move forward</li>
          <li>A D / ← → — Rotate</li>
          <li>Space — Front cannon</li>
          <li>Q / E — Left and right broadsides</li>
          <li>P / Esc — Pause</li>
        </ul>

        <p className="muted">
          On touch devices, hold the on-screen controls to move and fire.
        </p>
      </section>
    </main>
  );
}