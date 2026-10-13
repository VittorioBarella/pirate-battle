import { useEffect, useRef, useState } from "react";
import type { GameConfig } from "../config/gameConfig";
import { playerId } from "../api/contracts";
import type { Match } from "../api/contracts";
import { Input, keys } from "../game/input";
import type { Action } from "../game/input";
import { Simulation } from "../game/simulation";
import { GameRenderer, loadTextures } from "../game/renderer";

interface GameProps {
  config: GameConfig;
  name: string;
  onFinish: (match: Match) => void;
  onExit: () => void;
}

interface TestApi {
  state: () => ReturnType<Simulation["snapshot"]>;
  advance: (seconds: number) => void;
  setPlayer: (player: Partial<Simulation["player"]>) => void;
  spawn: (kind: "chaser" | "shooter", x: number, y: number) => void;
  clear: () => void;
}

declare global {
  interface Window {
    __battle?: TestApi;
    __observeBattle?: () => ReturnType<Simulation["snapshot"]>;
    __performance?: {
      frames: number[];
      entities: number[];
      resources: {
        ships: number;
        effects: number;
      };
    };
  }
}

const testing =
  import.meta.env.VITE_TEST_MODE === "true" &&
  new URLSearchParams(location.search).has("test");

const controls: {
  action: Action;
  label: string;
  text: string;
}[] = [
  { action: "left", label: "Rotate left", text: "↶" },
  { action: "forward", label: "Move forward", text: "↑" },
  { action: "right", label: "Rotate right", text: "↷" },
  { action: "port", label: "Fire port", text: "Q · Port" },
  { action: "front", label: "Fire front", text: "⦿ Fire" },
  {
    action: "starboard",
    label: "Fire starboard",
    text: "E · Starboard",
  },
];

export function Game({
  config,
  name,
  onFinish,
  onExit,
}: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  const input = useRef(new Input());
  const simRef = useRef<Simulation | null>(null);
  const finish = useRef(onFinish);

  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("Loading ships and sea…");
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({
    hp: config.player.health,
    score: 0,
    time: config.sessionTime,
  });

  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  const togglePause = (value: boolean) => {
    const simulation = simRef.current;

    if (!simulation || simulation.ended) return;

    simulation.paused = value;
    input.current.clear();
    setPaused(value);
  };

  const retryAssets = () => {
    setFailed(false);
    setPaused(false);
    setStatus("Loading ships and sea…");
    setRetry((value) => value + 1);
  };

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const activeInput = input.current;
    const simulation = new Simulation(config, activeInput);
    simRef.current = simulation;

    let disposed = false;
    let initialized = false;
    let completed = false;
    let attached = false;

    let renderer: GameRenderer | undefined;
    let observer: ResizeObserver | undefined;

    let accumulator = 0;
    let hudClock = 0;

    const publishHud = () => {
      setHud({
        hp: simulation.player.hp,
        score: simulation.score,
        time: Math.max(
          0,
          Math.ceil(
            simulation.config.sessionTime - simulation.elapsed,
          ),
        ),
      });
    };

    const finishIfNeeded = () => {
      if (!simulation.ended || completed || disposed) return;

      completed = true;
      publishHud();

      finish.current({
        id: crypto.randomUUID(),
        playerId,
        playerName: name,
        date: new Date().toISOString(),
        score: simulation.score,
        duration: Number(simulation.elapsed.toFixed(3)),
        reason: simulation.reason,
        config: simulation.config,
      });
    };

    const tick = (seconds: number) => {
      if (simulation.paused || simulation.ended) {
        accumulator = 0;
        return;
      }

      // Use fixed simulation steps and limit catch-up after a slow frame.
      accumulator += Math.min(seconds, 0.1);

      while (accumulator >= 1 / 60) {
        simulation.update(1 / 60);
        accumulator -= 1 / 60;

        if (simulation.ended) {
          accumulator = 0;
          break;
        }
      }

      hudClock += seconds;

      if (hudClock >= 0.1) {
        publishHud();
        hudClock = 0;
      }

      finishIfNeeded();
    };

    const pause = () => {
      if (disposed || completed) return;

      simulation.paused = true;
      activeInput.clear();
      accumulator = 0;
      setPaused(true);
    };

    const visibility = () => {
      if (document.hidden) pause();
    };

    const keydown = (event: KeyboardEvent) => {
      if (disposed || completed) return;

      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        if (!event.repeat) pause();
        return;
      }

      const action = keys[event.code];

      if (!simulation.paused && action) {
        event.preventDefault();
        activeInput.set(`key:${event.code}`, action);
      }
    };

    const keyup = (event: KeyboardEvent) => {
      activeInput.release(`key:${event.code}`);
    };

    const attachListeners = () => {
      attached = true;

      window.addEventListener("keydown", keydown);
      window.addEventListener("keyup", keyup);
      window.addEventListener("blur", pause);
      document.addEventListener("visibilitychange", visibility);
    };

    const detachListeners = () => {
      if (!attached) return;

      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);

      attached = false;
    };

    void (async () => {
      try {
        const textures = await loadTextures();
        if (disposed) return;

        renderer = new GameRenderer();
        await renderer.init(element, textures);
        initialized = true;

        if (disposed) {
          renderer.destroy();
          renderer = undefined;
          return;
        }

        const resize = () => {
          if (!renderer) return;

          const width = element.clientWidth;
          renderer.app.canvas.style.width = `${width}px`;
          renderer.app.canvas.style.height =
            `${(width * 600) / 960}px`;
        };

        observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();

        renderer.render(simulation);
        attachListeners();

        if (document.hidden || !document.hasFocus()) {
          pause();
        }

        publishHud();
        setStatus("");

        const metrics = {
          frames: [] as number[],
          entities: [] as number[],
          resources: { ships: 0, effects: 0 },
        };

        window.__performance = metrics;

        renderer.app.ticker.add((ticker) => {
          if (disposed || !renderer) return;

          if (!testing) {
            tick(ticker.deltaMS / 1000);
          }

          renderer.render(simulation);

          if (!simulation.paused && !simulation.ended) {
            metrics.frames.push(ticker.elapsedMS);
            metrics.entities.push(
              simulation.enemies.length +
                simulation.bullets.length +
                simulation.effects.length +
                1,
            );

            if (metrics.frames.length > 20000) {
              metrics.frames.shift();
              metrics.entities.shift();
            }
          }

          metrics.resources = {
            ships: renderer.ships.size,
            effects: renderer.effects.size,
          };
        });

        if (new URLSearchParams(location.search).has("profile")) {
          window.__observeBattle = () => simulation.snapshot();
        }

        // Controlled clock and fixtures are available only in test builds.
        if (testing) {
          window.__battle = {
            state: () => simulation.snapshot(),

            advance: (seconds) => {
              for (
                let frame = 0;
                frame < Math.round(seconds * 60);
                frame++
              ) {
                simulation.update(1 / 60);
              }

              renderer?.render(simulation);
              publishHud();
              finishIfNeeded();
            },

            setPlayer: (player) => {
              Object.assign(simulation.player, player);
            },

            spawn: (kind, x, y) => {
              simulation.spawn(kind, { x, y });
            },

            clear: () => {
              simulation.enemies = [];
              simulation.bullets = [];
              simulation.effects = [];
            },
          };
        }
      } catch (error) {
        observer?.disconnect();
        detachListeners();
        activeInput.clear();

        if (renderer && initialized) {
          renderer.destroy();
          renderer = undefined;
        }

        if (!disposed) {
          setFailed(true);
          setStatus(
            `Game could not load. ${
              error instanceof Error
                ? error.message
                : "Please try again."
            }`,
          );
        }
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      detachListeners();
      activeInput.clear();

      if (renderer && initialized) {
        renderer.destroy();
        renderer = undefined;
      }

      simRef.current = null;

      delete window.__battle;
      delete window.__observeBattle;

      if (window.__performance) {
        window.__performance.resources = {
          ships: 0,
          effects: 0,
        };
      }
    };
  }, [config, name, retry]);

  return (
    <main className="combat">
      <header className="battle-header">
        <div>
          <small>THE LAST TIDE</small>
          <h1>Pirate Battle</h1>
        </div>

        <div className="hud" aria-label="Battle status">
          <span>
            Hull <b data-testid="health">{hud.hp}</b>
          </span>
          <span>
            Score <b data-testid="score">{hud.score}</b>
          </span>
          <span>
            Time <b data-testid="time">{hud.time}s</b>
          </span>
        </div>

        <button
          disabled={Boolean(status) || paused}
          onClick={() => togglePause(true)}
        >
          Pause
        </button>
      </header>

      <div className="arena-wrap">
        <div className="arena" ref={host} />

        {status && (
          <div
            className="overlay"
            role={failed ? "alert" : "status"}
          >
            <div>
              <p>{status}</p>

              {failed && (
                <button onClick={retryAssets}>
                  Retry assets
                </button>
              )}

              <button className="quiet" onClick={onExit}>
                Main Menu
              </button>
            </div>
          </div>
        )}

        {paused && !status && (
          <PauseDialog
            resume={() => togglePause(false)}
            exit={onExit}
          />
        )}
      </div>

      <div className="touch-controls" aria-label="Touch controls">
        {controls.map(({ action, label, text }) => (
          <button
            key={action}
            aria-label={label}
            disabled={Boolean(status) || paused}
            style={{ touchAction: "none", userSelect: "none" }}
            onPointerDown={(event) => {
              const simulation = simRef.current;

              if (
                !simulation ||
                simulation.paused ||
                simulation.ended ||
                status
              ) {
                return;
              }

              event.currentTarget.setPointerCapture(event.pointerId);
              input.current.set(`touch:${event.pointerId}`, action);
            }}
            onPointerUp={(event) => {
              input.current.release(`touch:${event.pointerId}`);
            }}
            onPointerCancel={(event) => {
              input.current.release(`touch:${event.pointerId}`);
            }}
            onLostPointerCapture={(event) => {
              input.current.release(`touch:${event.pointerId}`);
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <p className="control-note">
        W / ↑ sail · A D / ← → turn · Space fire · Q E broadsides
        · P / Esc pause
        <br />
        <span className="legend">
          ● Red: Chaser · ● Blue: Shooter · Hold controls to sail
          and fire together.
        </span>
      </p>
    </main>
  );
}

function PauseDialog({
  resume,
  exit,
}: {
  resume: () => void;
  exit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();

    return () => {
      previous?.focus();
    };
  }, []);

  return (
    <div className="overlay">
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;

          const buttons = ref.current?.querySelectorAll("button");
          if (!buttons || buttons.length === 0) return;

          event.preventDefault();

          const current = Array.from(buttons).indexOf(
            document.activeElement as HTMLButtonElement,
          );

          const next =
            (current +
              (event.shiftKey ? -1 : 1) +
              buttons.length) %
            buttons.length;

          buttons[next]?.focus();
        }}
      >
        <small>DROP ANCHOR</small>
        <h2 id="pause-title">Battle paused</h2>
        <p>Time stands still. Ready when you are.</p>

        <button onClick={resume}>Resume</button>

        <button className="quiet" onClick={exit}>
          Abandon · Main Menu
        </button>

        <p className="muted">
          Abandoned battles are not recorded.
        </p>
      </div>
    </div>
  );
}