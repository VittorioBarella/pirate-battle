import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Simulation } from "../src/game/simulation";

type TestWindow = Window & {
  __battle?: {
    state: () => ReturnType<Simulation["snapshot"]>;
    clear: () => void;
    setPlayer: (values: {
      x: number;
      y: number;
      angle: number;
    }) => void;
    advance: (seconds: number) => void;
  };
};

async function start(page: Page) {
  await page.goto("/?test");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(
    () => Boolean((window as TestWindow).__battle),
  );

  const dialog = page.getByRole("dialog", { name: "Battle paused" });

  if (await dialog.isVisible()) {
    await dialog.getByRole("button", {
      name: "Resume",
      exact: true,
    }).click();
  }

  await page.evaluate(() => {
    const battle = (window as TestWindow).__battle!;
    battle.clear();
    battle.setPlayer({ x: 100, y: 430, angle: 0 });
  });
}

async function point(page: Page, name: string, id: number) {
  const button = page.getByRole("button", { name, exact: true });
  await button.scrollIntoViewIfNeeded();

  const box = await button.boundingBox();
  if (!box) throw new Error(`Control unavailable: ${name}`);

  return {
    id,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  };
}

async function advance(page: Page, seconds: number) {
  return page.evaluate((value) => {
    const battle = (window as TestWindow).__battle!;
    battle.advance(value);
    return battle.state();
  }, seconds);
}

test("moves and fires with simultaneous touches and stops after release", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, "Requires mobile touch emulation.");

  await start(page);
  const session = await context.newCDPSession(page);

  const forward = await point(page, "Move forward", 1);
  const fire = await point(page, "Fire front", 2);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [forward, fire],
  });

  const active = await advance(page, 0.2);
  expect(active.player.x).toBeGreaterThan(100);
  expect(active.bullets).toHaveLength(1);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  const released = await advance(page, 0.5);
  expect(released.player.x).toBeCloseTo(active.player.x);
  expect(released.player.y).toBeCloseTo(active.player.y);

  // The original projectile may move, but no new shot may be created.
  expect(released.bullets.map((bullet) => bullet.id)).toEqual(
    active.bullets.map((bullet) => bullet.id),
  );

  await session.detach();
});

test("clears cancelled touches without cancelling a held keyboard action", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, "Requires mobile touch emulation.");

  await start(page);
  const session = await context.newCDPSession(page);

  const forward = await point(page, "Move forward", 1);
  const fire = await point(page, "Fire front", 2);

  await page.keyboard.down("KeyW");

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [forward, fire],
  });

  const active = await advance(page, 0.2);
  expect(active.player.x).toBeGreaterThan(100);
  expect(active.bullets).toHaveLength(1);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });

  const cancelled = await advance(page, 0.5);

  // Keyboard W still holds movement after the touch source is cancelled.
  expect(cancelled.player.x).toBeGreaterThan(active.player.x);
  expect(cancelled.bullets.map((bullet) => bullet.id)).toEqual(
    active.bullets.map((bullet) => bullet.id),
  );

  await page.keyboard.up("KeyW");
  const stopped = await advance(page, 0.2);

  expect(stopped.player.x).toBeCloseTo(cancelled.player.x);
  expect(stopped.player.y).toBeCloseTo(cancelled.player.y);

  await session.detach();
});