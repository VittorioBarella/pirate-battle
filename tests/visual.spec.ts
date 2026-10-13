import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type TestWindow = Window & {
  __battle?: {
    clear: () => void;
    setPlayer: (values: { x: number; y: number; hp: number }) => void;
    spawn: (kind: "chaser" | "shooter", x: number, y: number) => void;
    advance: (seconds: number) => void;
  };
};

async function startBattle(page: Page) {
  await page.goto("/?test");

  await page.getByRole("button", {
    name: "Play",
    exact: true,
  }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(
    () => Boolean((window as TestWindow).__battle),
  );

  const dialog = page.getByRole("dialog", {
    name: "Battle paused",
  });

  if (await dialog.isVisible()) {
    await dialog.getByRole("button", {
      name: "Resume",
      exact: true,
    }).click();
  }

  await expect(dialog).not.toBeVisible();

  await expect(page.getByRole("button", {
    name: "Pause",
    exact: true,
  })).toBeEnabled();
}

test("main menu visual baseline", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", {
    name: "Pirate Battle",
    exact: true,
  })).toBeVisible();

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toBeVisible();

  await expect(page.getByRole("button", {
    name: "Refresh",
    exact: true,
  })).toBeEnabled();

  await expect(page).toHaveScreenshot("menu.png", {
    fullPage: true,
    animations: "disabled",
    // Dates are covered by functional tests; avoid timezone-dependent pixels.
    mask: [page.locator("time")],
  });
});

test("initial arena visual baseline", async ({ page }) => {
  await startBattle(page);

  await expect(page.getByTestId("health")).toHaveText("100");
  await expect(page.getByTestId("score")).toHaveText("0");
  await expect(page.getByTestId("time")).toHaveText("120s");

  await expect(page).toHaveScreenshot("arena.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("completed battle visual baseline", async ({ page }) => {
  await startBattle(page);

  await page.evaluate(() => {
    const battle = (window as TestWindow).__battle;

    if (!battle) throw new Error("Game test bridge unavailable.");

    battle.clear();
    battle.setPlayer({ x: 100, y: 430, hp: 1 });
    battle.spawn("chaser", 100, 430);
    battle.advance(1 / 60);
  });

  await expect(page.getByRole("heading", {
    name: "Battle complete",
    exact: true,
  })).toBeVisible();

  await expect(page.getByText(
    "Battle registered successfully.",
    { exact: true },
  )).toBeVisible();

  await expect(page.getByRole("button", {
    name: "Retry pending",
    exact: true,
  })).toHaveCount(0);

  await expect(page).toHaveScreenshot("result.png", {
    fullPage: true,
    animations: "disabled",
  });
});