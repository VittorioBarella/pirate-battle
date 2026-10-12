import { test, expect } from "@playwright/test";
import {
  defaultOptions,
  makeConfig,
} from "../src/config/gameConfig";
import { Input } from "../src/game/input";
import { Simulation } from "../src/game/simulation";

test("keeps an independent configuration for each match", () => {
  const config = makeConfig(defaultOptions);
  const simulation = new Simulation(config, new Input());

  const originalSpeed = config.player.speed;
  const originalDuration = config.sessionTime;

  config.player.speed = 999;
  config.sessionTime = 60;

  expect(simulation.config.player.speed).toBe(originalSpeed);
  expect(simulation.config.sessionTime).toBe(originalDuration);
});

test("freezes movement, weapons and time while paused", () => {
  const input = new Input();
  const simulation = new Simulation(makeConfig(defaultOptions), input);

  input.set("keyboard:KeyW", "forward");
  input.set("keyboard:Space", "front");

  simulation.update(1 / 60);
  simulation.paused = true;

  const before = simulation.snapshot();

  for (let frame = 0; frame < 120; frame++) {
    simulation.update(1 / 60);
  }

  expect(simulation.snapshot()).toEqual(before);
});

test("removes an expired projectile without exceeding its lifetime", () => {
  const simulation = new Simulation(
    makeConfig(defaultOptions),
    new Input(),
  );

  const bullet = {
    id: 1000,
    x: 100,
    y: 100,
    vx: 100,
    vy: 0,
    life: 0.005,
    damage: 25,
    owner: "player" as const,
  };

  simulation.bullets.push(bullet);
  simulation.update(1 / 60);

  expect(bullet.x).toBeCloseTo(100.5);
  expect(bullet.life).toBe(0);
  expect(simulation.bullets).toHaveLength(0);
});

test("ends on a lethal Chaser impact without awarding points", () => {
  const input = new Input();
  const simulation = new Simulation(makeConfig(defaultOptions), input);

  simulation.player.hp = 1;

  simulation.spawn("chaser", {
    x: simulation.player.x + 30,
    y: simulation.player.y,
  });

  simulation.update(1 / 60);

  expect(simulation.player.hp).toBe(0);
  expect(simulation.ended).toBe(true);
  expect(simulation.reason).toBe("death");
  expect(simulation.score).toBe(0);

  const before = simulation.snapshot();

  input.set("keyboard:KeyW", "forward");
  input.set("keyboard:Space", "front");
  simulation.update(1);

  expect(simulation.snapshot()).toEqual(before);
});