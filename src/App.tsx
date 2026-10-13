import { useEffect, useState } from "react";
import { Game } from "./components/Game";
import { Options } from "./components/Options";
import { DataPanel } from "./components/DataPanel";
import { useMatchSubmission } from "./hooks/useMatchSubmission";
import {
  configKey,
  defaultOptions,
  makeConfig,
} from "./config/gameConfig";
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

interface PendingNoticeProps {
  count: number;
  isSending: boolean;
  onRetry: () => void;
}

function PendingNotice({
  count,
  isSending,
  onRetry,
}: PendingNoticeProps) {
  if (count === 0) return null;

  return (
    <aside className="pending" aria-label="Pending match submissions">
      <p role="status" style={{ margin: 0 }}>
        {isSending
          ? `Sending saved battles… ${count} pending.`
          : `${count} battle(s) saved locally and awaiting registration.`}
      </p>
      <button disabled={isSending} onClick={onRetry}>
        Retry pending
      </button>
    </aside>
  );
}

export default function App() {
  const [options, setOptions] = useState(loadOptions);
  const [showOptions, setShowOptions] = useState(false);
  const [matchConfig, setMatchConfig] = useState<GameConfig | null>(null);
  const [result, setResult] = useState<Match | null>(() =>
    read<Match | null>("last", null),
  );
  const [resource, setResource] = useState<"ranking" | "history">("ranking");

  const { pending, isSending, submit, retryPending } = useMatchSubmission();
  const rankingConfig = configKey(makeConfig(options));

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
    submit(match);
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
    const resultPending = pending.some((match) => match.id === result.id);
    return (
      <main className="shell">
        <section className="card result" aria-labelledby="result-title">
                    <img
            src="/assets/logo_jungle_gaming.svg"
            alt="Jungle Gaming"
            width={140}
            style={{
              display: "block",
              height: "auto",
              marginBottom: "24px",
            }}
          />
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

          <p role="status">
            {resultPending
              ? "This battle is saved locally. Registration is pending."
              : "Battle registered successfully."}
          </p>

          <PendingNotice
            count={pending.length}
            isSending={isSending}
            onRetry={retryPending}
          />

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

      <PendingNotice
        count={pending.length}
        isSending={isSending}
        onRetry={retryPending}
      />

      <nav className="actions" aria-label="Battle records">
        <button
          type="button"
          className={resource === "ranking" ? "primary" : "quiet"}
          aria-pressed={resource === "ranking"}
          onClick={() => setResource("ranking")}
        >
          Ranking
        </button>
        <button
          type="button"
          className={resource === "history" ? "primary" : "quiet"}
          aria-pressed={resource === "history"}
          onClick={() => setResource("history")}
        >
          History
        </button>
      </nav>

      <DataPanel
        key={`${resource}:${rankingConfig}`}
        resource={resource}
        config={rankingConfig}
      />
    </main>
  );
}