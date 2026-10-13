import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Body, Simulation } from "../src/game/simulation";

declare global {
  interface Window {
    __battle?: {
      state: () => ReturnType<Simulation["snapshot"]>;
      advance: (seconds: number) => void;
      setPlayer: (values: Partial<Body>) => void;
      spawn: (
        kind: "chaser" | "shooter",
        x: number,
        y: number,
      ) => void;
      clear: () => void;
    };
  }
}

async function start(page: Page) {
  await page.goto("/?test");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(() => Boolean(window.__battle));

  const dialog = page.getByRole("dialog", { name: "Battle paused" });

  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "Resume", exact: true }).click();
  }
}

async function advance(page: Page, seconds: number) {
  await page.evaluate((value) => {
    if (!window.__battle) throw new Error("Game test bridge unavailable.");
    window.__battle.advance(value);
  }, seconds);
}

async function state(page: Page) {
  return page.evaluate(() => {
    if (!window.__battle) throw new Error("Game test bridge unavailable.");
    return window.__battle.state();
  });
}

test("moves, rotates and respects arena and island boundaries", async ({
  page,
}) => {
  await start(page);

  await page.evaluate(() => {
    window.__battle!.clear();
    window.__battle!.setPlayer({ x: 100, y: 430, angle: 0 });
  });

  await page.keyboard.down("KeyW");
  await advance(page, 0.5);
  await page.keyboard.up("KeyW");

  const moved = await state(page);
  expect(moved.player.x).toBeGreaterThan(100);
  expect(moved.player.y).toBeCloseTo(430);

  await page.keyboard.down("KeyD");
  await advance(page, 0.2);
  await page.keyboard.up("KeyD");

  expect((await state(page)).player.angle).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__battle!.setPlayer({ x: 930, y: 100, angle: 0 });
  });

  await page.keyboard.down("KeyW");
  await advance(page, 0.5);
  await page.keyboard.up("KeyW");

  const bounded = await state(page);
  expect(bounded.player.x).toBeLessThanOrEqual(
    960 - bounded.player.radius,
  );

  // Approach the central island from its left side.
  await page.evaluate(() => {
    window.__battle!.setPlayer({ x: 370, y: 285, angle: 0 });
  });

  await page.keyboard.down("KeyW");
  await advance(page, 0.5);
  await page.keyboard.up("KeyW");

  const blocked = await state(page);
  expect(blocked.player.x).toBeGreaterThan(370);
  expect(
    Math.hypot(blocked.player.x - 480, blocked.player.y - 285),
  ).toBeGreaterThanOrEqual(73 + blocked.player.radius);
});

test("fires front and parallel broadside shots with cooldowns", async ({
  page,
}) => {
  await start(page);

  await page.evaluate(() => {
    window.__battle!.clear();
    window.__battle!.setPlayer({ x: 400, y: 430, angle: 0 });
  });

  await page.keyboard.down("Space");
  await advance(page, 0.1);

  expect((await state(page)).bullets).toHaveLength(1);

  await advance(page, 0.1);
  expect((await state(page)).bullets).toHaveLength(1);

  await advance(page, 0.25);
  expect((await state(page)).bullets).toHaveLength(2);
  await page.keyboard.up("Space");

  await page.evaluate(() => window.__battle!.clear());

  await page.keyboard.down("KeyQ");
  await page.keyboard.down("KeyE");
  await advance(page, 1 / 60);
  await page.keyboard.up("KeyQ");
  await page.keyboard.up("KeyE");

  const broadside = await state(page);
  expect(broadside.bullets).toHaveLength(6);

  const port = broadside.bullets.filter((bullet) => bullet.vy < 0);
  const starboard = broadside.bullets.filter((bullet) => bullet.vy > 0);

  expect(port).toHaveLength(3);
  expect(starboard).toHaveLength(3);

  for (const group of [port, starboard]) {
    for (const bullet of group) {
      expect(bullet.vx).toBeCloseTo(0);
      expect(bullet.vy).toBeCloseTo(group[0].vy);
    }

    expect(new Set(group.map((bullet) => bullet.x)).size).toBe(3);
  }
});

test("damages an enemy and awards exactly one point for its destruction", async ({
  page,
}) => {
  await start(page);

  await page.evaluate(() => {
    window.__battle!.clear();
    window.__battle!.setPlayer({ x: 100, y: 430, angle: 0 });
    window.__battle!.spawn("chaser", 300, 430);
  });

  const initial = await state(page);

  await page.keyboard.down("Space");
  await advance(page, 0.35);
  await page.keyboard.up("Space");

  const damaged = await state(page);
  expect(damaged.enemies).toHaveLength(1);
  expect(damaged.enemies[0].hp).toBeLessThan(initial.enemies[0].hp);
  expect(damaged.score).toBe(0);

  await page.keyboard.down("Space");
  await advance(page, 0.5);
  await page.keyboard.up("Space");

  const destroyed = await state(page);
  expect(destroyed.enemies).toHaveLength(0);
  expect(destroyed.score).toBe(1);
  await expect(page.getByTestId("score")).toHaveText("1");

  await advance(page, 0.5);
  expect((await state(page)).score).toBe(1);
});

test("ends on player death and starts a fresh battle", async ({ page }) => {
  await start(page);

  await page.evaluate(() => {
    window.__battle!.clear();
    window.__battle!.setPlayer({ x: 100, y: 430, hp: 1 });
    window.__battle!.spawn("chaser", 100, 430);
  });

  await advance(page, 1 / 60);

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();

  await expect(page.getByText("Your ship was destroyed.", {
    exact: true,
  })).toBeVisible();

  await expect(page.getByTestId("game-canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "Play Again", exact: true }).click();
  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(() => Boolean(window.__battle));

  const fresh = await state(page);
  expect(fresh.player.hp).toBe(100);
  expect(fresh.score).toBe(0);
  expect(fresh.elapsed).toBe(0);
  expect(fresh.ended).toBe(false);
});

test("reports an asset failure and recovers after a clean reload", async ({
  page,
}) => {
  await page.goto("/?test&assetFailure=1");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Game could not load", {
    timeout: 15_000,
  });

  const retry = page.getByRole("button", {
    name: "Retry assets",
    exact: true,
  });

  await expect(retry).toBeVisible();
  await retry.click();

  // The simulated missing asset remains unavailable until the flag is removed.
  await expect(alert).toContainText("Game could not load", {
    timeout: 15_000,
  });

  await start(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
});