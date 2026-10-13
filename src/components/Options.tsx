import { useState } from "react";
import type { defaultOptions } from "../config/gameConfig";

type OptionsValue = typeof defaultOptions;

interface OptionsProps {
  value: OptionsValue;
  onSave: (value: OptionsValue) => void;
  onCancel: () => void;
}

export function Options({ value, onSave, onCancel }: OptionsProps) {
  const [sessionTime, setSessionTime] = useState(String(value.sessionTime));
  const [spawnTime, setSpawnTime] = useState(String(value.spawnTime));
  const [error, setError] = useState("");

  return (
    <main className="shell">
      <form
        className="card options"
        aria-labelledby="options-title"
        onSubmit={(event) => {
          event.preventDefault();

          const next = {
            sessionTime: Number(sessionTime),
            spawnTime: Number(spawnTime),
          };

          if (
            !Number.isFinite(next.sessionTime) ||
            next.sessionTime < 60 ||
            next.sessionTime > 180 ||
            !Number.isFinite(next.spawnTime) ||
            next.spawnTime < 1 ||
            next.spawnTime > 15
          ) {
            setError("Enter a duration of 60–180s and a spawn interval of 1–15s.");
            return;
          }

          onSave(next);
        }}
      >
        <small>PREPARE YOUR VOYAGE</small>
        <h1 id="options-title">Options</h1>

        <label htmlFor="session-time">Session duration (seconds)</label>
        <input
          id="session-time"
          type="number"
          min="60"
          max="180"
          step="any"
          required
          value={sessionTime}
          onChange={(event) => setSessionTime(event.target.value)}
          aria-describedby="session-help"
        />
        <p id="session-help" className="muted">
          Between 60 and 180 seconds of active gameplay.
        </p>

        <label htmlFor="spawn-time">Enemy spawn interval (seconds)</label>
        <input
          id="spawn-time"
          type="number"
          min="1"
          max="15"
          step="any"
          required
          value={spawnTime}
          onChange={(event) => setSpawnTime(event.target.value)}
          aria-describedby="spawn-help"
        />
        <p id="spawn-help" className="muted">
          Between 1 and 15 seconds. Lower values increase difficulty.
        </p>

        {error && <p role="alert">{error}</p>}

        <div className="actions">
          <button className="primary" type="submit">
            Save Options
          </button>
          <button className="quiet" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}