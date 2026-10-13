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
test("spawns both enemy types and applies Shooter projectile damage", async ({
  page,
}) => {
  await start(page);

  await advance(page, 4);

  const firstSpawn = await state(page);
  expect(firstSpawn.spawnCount).toBe(1);
  expect(
    firstSpawn.enemies.some((enemy) => enemy.kind === "chaser"),
  ).toBe(true);

  await advance(page, 4);

  const secondSpawn = await state(page);
  expect(secondSpawn.spawnCount).toBe(2);
  expect(
    secondSpawn.enemies.some((enemy) => enemy.kind === "shooter"),
  ).toBe(true);

  // Isolate a Shooter within firing range in an unobstructed area.
  await page.evaluate(() => {
    window.__battle!.clear();
    window.__battle!.setPlayer({
      x: 300,
      y: 430,
      hp: 100,
      angle: 0,
    });
    window.__battle!.spawn("shooter", 100, 430);
  });

  await advance(page, 2.3);

  const attacked = await state(page);
  expect(attacked.player.hp).toBeLessThan(100);
  expect(attacked.player.hp).toBeGreaterThan(0);
  expect(attacked.score).toBe(0);
  expect(attacked.enemies).toHaveLength(1);

  await expect(page.getByTestId("health")).toHaveText(
    String(attacked.player.hp),
  );
});

test("ends at the configured time and restores the result after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Session duration (seconds)").fill("60");
  await page.getByLabel("Enemy spawn interval (seconds)").fill("15");
  await page.getByRole("button", { name: "Save Options" }).click();

  await start(page);

// Remove enemies between steps to isolate the session deadline.
await page.evaluate(() => {
  const battle = window.__battle;

  if (!battle) throw new Error("Game test bridge unavailable.");

  for (let step = 0; step < 119; step++) {
    battle.clear();
    battle.advance(0.5);
  }
});

  await expect(page.getByTestId("game-canvas")).toBeVisible();

  const beforeEnd = await state(page);
  expect(beforeEnd.ended).toBe(false);
  expect(beforeEnd.elapsed).toBeCloseTo(59.5);

  await page.evaluate(() => window.__battle!.clear());
  await advance(page, 1);

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText("Time expired.", { exact: true }),
  ).toBeVisible();

  await expect(page.getByTestId("game-canvas")).toHaveCount(0);

  const last = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem("pb:last") ?? "null") as {
      id: string;
      duration: number;
      reason: string;
      config: { sessionTime: number };
    } | null;
  });

  expect(last).not.toBeNull();
  expect(last!.duration).toBe(60);
  expect(last!.reason).toBe("time");
  expect(last!.config.sessionTime).toBe(60);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText("Time expired.", { exact: true }),
  ).toBeVisible();

  const restoredId = await page.evaluate(() => {
    const result = JSON.parse(
      localStorage.getItem("pb:last") ?? "null",
    ) as { id: string } | null;

    return result?.id;
  });

  expect(restoredId).toBe(last!.id);
});

test("abandons battles without recording them and allows repeated navigation", async ({
  page,
}) => {
  await start(page);

  for (let cycle = 0; cycle < 3; cycle++) {
    await advance(page, 0.2);

    await page.getByRole("button", {
      name: "Pause",
      exact: true,
    }).click();

    const dialog = page.getByRole("dialog", { name: "Battle paused" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", {
      name: "Abandon · Main Menu",
      exact: true,
    }).click();

    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId("game-canvas")).toHaveCount(0);

    const saved = await page.evaluate(() => ({
      last: JSON.parse(localStorage.getItem("pb:last") ?? "null"),
      pending: JSON.parse(localStorage.getItem("pb:pending") ?? "[]"),
      confirmed: JSON.parse(localStorage.getItem("pb:confirmed") ?? "[]"),
    }));

    expect(saved.last).toBeNull();
    expect(saved.pending).toEqual([]);
    expect(saved.confirmed).toEqual([]);

    if (cycle < 2) {
      await start(page);
      await expect(page.getByTestId("game-canvas")).toHaveCount(1);

      const fresh = await state(page);
      expect(fresh.elapsed).toBe(0);
      expect(fresh.score).toBe(0);
      expect(fresh.player.hp).toBe(100);
    }
  }
});