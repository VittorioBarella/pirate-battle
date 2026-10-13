import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type TestWindow = Window & {
  __battle?: {
    advance: (seconds: number) => void;
  };
};

async function advance(page: Page, seconds: number) {
  await page.evaluate((value) => {
    const battle = (window as TestWindow).__battle;

    if (!battle) {
      throw new Error("The game test clock is unavailable.");
    }

    battle.advance(value);
  }, seconds);
}

test("saves options and restores them after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();

  await page.getByLabel("Session duration (seconds)").fill("90");
  await page.getByLabel("Enemy spawn interval (seconds)").fill("6");
  await page.getByRole("button", { name: "Save Options" }).click();

  await expect(
    page.getByText("Session: 90s · Enemy spawn: every 6s"),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByText("Session: 90s · Enemy spawn: every 6s"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Options", exact: true }).click();

  await expect(
    page.getByLabel("Session duration (seconds)"),
  ).toHaveValue("90");

  await expect(
    page.getByLabel("Enemy spawn interval (seconds)"),
  ).toHaveValue("6");
});

test("rejects empty and out-of-range options", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();

  const session = page.getByLabel("Session duration (seconds)");
  const spawn = page.getByLabel("Enemy spawn interval (seconds)");
  const save = page.getByRole("button", { name: "Save Options" });

  for (const invalid of ["", "59", "181"]) {
    await session.fill(invalid);
    await save.click();

    expect(
      await session.evaluate(
        (element) => (element as HTMLInputElement).validity.valid,
      ),
    ).toBe(false);

    await expect(
      page.getByRole("heading", { name: "Options", exact: true }),
    ).toBeVisible();
  }

  await session.fill("120");

  for (const invalid of ["", "0", "16"]) {
    await spawn.fill(invalid);
    await save.click();

    expect(
      await spawn.evaluate(
        (element) => (element as HTMLInputElement).validity.valid,
      ),
    ).toBe(false);

    await expect(
      page.getByRole("heading", { name: "Options", exact: true }),
    ).toBeVisible();
  }

  await page.reload();
  await page.getByRole("button", { name: "Options", exact: true }).click();

  await expect(session).toHaveValue("120");
  await expect(spawn).toHaveValue("4");
});

test("cancels option changes without saving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();

  await page.getByLabel("Session duration (seconds)").fill("90");
  await page.getByLabel("Enemy spawn interval (seconds)").fill("6");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(
    page.getByText("Session: 120s · Enemy spawn: every 4s"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Options", exact: true }).click();

  await expect(
    page.getByLabel("Session duration (seconds)"),
  ).toHaveValue("120");

  await expect(
    page.getByLabel("Enemy spawn interval (seconds)"),
  ).toHaveValue("4");
});

test("freezes time during manual and focus-loss pauses", async ({ page }) => {
  await page.goto("/?test");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(() => Boolean((window as TestWindow).__battle));

  const pause = page.getByRole("button", { name: "Pause", exact: true });
  const dialog = page.getByRole("dialog", { name: "Battle paused" });
  const resume = dialog.getByRole("button", { name: "Resume", exact: true });
  const time = page.getByTestId("time");

  // A background browser may start paused; explicitly resume if needed.
  if (await dialog.isVisible()) {
    await resume.click();
  }

  await advance(page, 2);
  await expect(time).toHaveText("118s");

  await pause.click();
  await expect(dialog).toBeVisible();
  await expect(resume).toBeFocused();

  await advance(page, 10);
  await expect(time).toHaveText("118s");

  await resume.click();
  await expect(dialog).not.toBeVisible();

  await advance(page, 1);
  await expect(time).toHaveText("117s");

  // Exercise the actual blur listener registered by Game.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));

  await expect(dialog).toBeVisible();
  await advance(page, 10);
  await expect(time).toHaveText("117s");

  // Regaining focus must not resume the game automatically.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog).toBeVisible();

  await advance(page, 1);
  await expect(time).toHaveText("117s");

await resume.click();
await advance(page, 1.1);

await expect(dialog).not.toBeVisible();
await expect(time).toHaveText("116s");
});