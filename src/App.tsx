import { useEffect, useState } from "react";
import { Game } from "./components/Game";
import { Options } from "./components/Options";
import { defaultOptions, makeConfig } from "./config/gameConfig";
import type { GameConfig } from "./config/gameConfig";
import type { Match } from "./api/contracts";
import { read, write } from "./api/storage";
import "./styles.css";

type OptionsValue = typeof defaultOptions;

function loadOptions(): OptionsValue {
  const stored = read<OptionsValue | null>("options", null);

  if (
    !stored ||
    !Number.isFinite(stored.sessionTime) ||
    stored.sessionTime < 60 ||
    stored.sessionTime > 180 ||
    !Number.isFinite(stored.spawnTime) ||
    stored.spawnTime < 1 ||
    stored.spawnTime > 15
  ) {
    return { ...defaultOptions };
  }

  return {
    sessionTime: stored.sessionTime,
    spawnTime: stored.spawnTime,
  };
}

export default function App() {
  const [options, setOptions] = useState(loadOptions);
  const [showOptions, setShowOptions] = useState(false);
  const [matchConfig, setMatchConfig] = useState<GameConfig | null>(null);
  const [result, setResult] = useState<Match | null>(null);

  const screen = matchConfig
    ? "game"
    : showOptions
      ? "options"
      : result
        ? "result"
        : "menu";

  useEffect(() => {
    if (screen === "game") return;

    const heading = document.querySelector<HTMLHeadingElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, [screen]);

  const startGame = () => {
    setResult(null);
    setShowOptions(false);
    setMatchConfig(makeConfig(options));
  };

  const finishGame = (match: Match) => {
    setResult(match);
    setMatchConfig(null);
  };

  const openMenu = () => {
    setMatchConfig(null);
    setResult(null);
    setShowOptions(false);
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

  if (showOptions) {
    return (
      <Options
        value={options}
        onSave={(next) => {
          write("options", next);
          setOptions(next);
          setShowOptions(false);
        }}
        onCancel={() => setShowOptions(false)}
      />
    );
  }

  if (result) {
    return (
      <main className="shell">
        <section className="card result" aria-labelledby="result-title">
          <small>THE LAST TIDE</small>
          <h1 id="result-title">Battle complete</h1>

          <div className="result-stats">
            <div>
              <b>{result.score}</b>
              <span>Score</span>
            </div>
            <div>
              <b>{result.duration.toFixed(1)}s</b>
              <span>Time played</span>
            </div>
          </div>

          <p>
            {result.reason === "death"
              ? "Your ship was destroyed."
              : "Time expired."}
          </p>

          <p className="muted">
            Match registration will be available after API integration.
          </p>

          <div className="actions">
            <button className="primary" onClick={startGame}>
              Play Again
            </button>
            <button className="quiet" onClick={openMenu}>
              Main Menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="menu-title">
        <small className="eyebrow">THE LAST TIDE</small>
        <h1 id="menu-title">Pirate Battle</h1>

        <p>
          Navigate the islands, defeat enemy ships and survive the battle.
        </p>

        <p className="muted">
          Session: {options.sessionTime}s · Enemy spawn: every{" "}
          {options.spawnTime}s
        </p>

        <div className="actions">
          <button className="primary" onClick={startGame}>
            Play
          </button>
          <button onClick={() => setShowOptions(true)}>Options</button>
        </div>

        <h2>Controls</h2>
        <ul>
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