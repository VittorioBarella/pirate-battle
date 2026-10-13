import { test, expect } from "@playwright/test";
import { defaultOptions, makeConfig } from "../src/config/gameConfig";
import { Input } from "../src/game/input";
import { Simulation } from "../src/game/simulation";

function createSimulation() {
  const config = makeConfig(defaultOptions);

  // Keep targets stationary to isolate projectile collision rules.
  config.shooter.speed = 0;

  return new Simulation(config, new Input());
}

test("an island blocks a projectile before it reaches an enemy", () => {
  const simulation = createSimulation();

  Object.assign(simulation.player, {
    x: 350,
    y: 285,
    angle: 0,
  });

  simulation.spawn("shooter", { x: 650, y: 285 });

  const enemy = simulation.enemies[0];
  enemy.cooldown = 999;
  const initialHealth = enemy.hp;

  // Cross the central island in one step to exercise swept collision.
  simulation.fire(
    simulation.player,
    0,
    { ...simulation.config.front, speed: 20_000 },
    1,
    "player",
  );

  simulation.update(0.02);

  expect(enemy.hp).toBe(initialHealth);
  expect(simulation.bullets).toHaveLength(0);
  expect(simulation.score).toBe(0);
});

test("a projectile damages only the nearest target and is removed", () => {
  const simulation = createSimulation();

  Object.assign(simulation.player, {
    x: 100,
    y: 430,
    angle: 0,
  });

  simulation.spawn("shooter", { x: 200, y: 430 });
  simulation.spawn("shooter", { x: 280, y: 430 });

  const [nearest, farther] = simulation.enemies;

  nearest.cooldown = 999;
  farther.cooldown = 999;

  const nearestHealth = nearest.hp;
  const fartherHealth = farther.hp;
  const damage = simulation.config.front.damage;

  // Both targets lie within the projectile's movement segment.
  simulation.fire(
    simulation.player,
    0,
    { ...simulation.config.front, speed: 20_000 },
    1,
    "player",
  );

  simulation.update(0.01);

  expect(nearest.hp).toBe(nearestHealth - damage);
  expect(farther.hp).toBe(fartherHealth);
  expect(simulation.bullets).toHaveLength(0);
  expect(simulation.score).toBe(0);

  simulation.update(0.01);

  expect(nearest.hp).toBe(nearestHealth - damage);
  expect(farther.hp).toBe(fartherHealth);
});