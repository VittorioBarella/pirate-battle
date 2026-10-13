import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type TestWindow = Window & {
  __battle?: {
    advance: (seconds: number) => void;
    setPlayer: (values: { x: number; y: number; hp: number }) => void;
    spawn: (kind: "chaser" | "shooter", x: number, y: number) => void;
    clear: () => void;
  };
};

async function setScenario(page: Page, scenario: string) {
  await page.evaluate((value) => {
    localStorage.setItem("pb:scenario", JSON.stringify(value));
  }, scenario);
}

async function completeBattle(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await page.waitForFunction(
    () => Boolean((window as TestWindow).__battle),
  );

  const dialog = page.getByRole("dialog", { name: "Battle paused" });

  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "Resume", exact: true }).click();
  }

  await page.evaluate(() => {
    const battle = (window as TestWindow).__battle;

    if (!battle) throw new Error("Game test bridge unavailable.");

    battle.clear();
    battle.setPlayer({ x: 100, y: 430, hp: 1 });
    battle.spawn("chaser", 100, 430);
    battle.advance(1 / 60);
  });

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();
}

async function storedIds(page: Page, key: string): Promise<string[]> {
  return page.evaluate((name) => {
    const records = JSON.parse(
      localStorage.getItem(`pb:${name}`) ?? "[]",
    ) as { id: string }[];

    return records.map((record) => record.id);
  }, key);
}

async function checkSingleHistoryRecord(page: Page) {
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();

  const table = page.getByRole("table", {
    name: "History records",
    exact: true,
  });

  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toContainText("Captain");
  await expect(page.getByText("Page 1 of 1 · 1 records", {
    exact: true,
  })).toBeVisible();
}

test("preserves an offline submission across reload and retries without duplication", async ({
  page,
}) => {
  await page.goto("/?test");
  await setScenario(page, "offline");
  await completeBattle(page);

  await expect(
    page.getByText(
      "This battle is saved locally. Registration is pending.",
      { exact: true },
    ),
  ).toBeVisible();

  const pendingIds = await storedIds(page, "pending");
  expect(pendingIds).toHaveLength(1);
  expect(await storedIds(page, "confirmed")).toHaveLength(0);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();

  expect(await storedIds(page, "pending")).toEqual(pendingIds);

  // Wait until the failed startup attempt finishes before retrying.
  const retry = page.getByRole("button", {
    name: "Retry pending",
    exact: true,
  });

  await expect(retry).toBeEnabled({ timeout: 15_000 });

  await setScenario(page, "success");
  await retry.click();

  await expect.poll(
    () => storedIds(page, "pending"),
    { timeout: 15_000 },
  ).toEqual([]);

  expect(await storedIds(page, "confirmed")).toEqual(pendingIds);

  await page.reload();

  await expect(
    page.getByText("Battle registered successfully.", { exact: true }),
  ).toBeVisible();

  expect(await storedIds(page, "confirmed")).toEqual(pendingIds);
  await checkSingleHistoryRecord(page);
});

test("recovers an ambiguous timeout with exactly one confirmed match", async ({
  page,
}) => {
  await page.goto("/?test");
  await setScenario(page, "commit-timeout");
  await completeBattle(page);

  await expect.poll(
    async () => (await storedIds(page, "confirmed")).length,
    { timeout: 15_000 },
  ).toBe(1);

  const confirmedIds = await storedIds(page, "confirmed");

  await expect.poll(
    () => storedIds(page, "pending"),
    { timeout: 15_000 },
  ).toEqual([]);

  await expect(
    page.getByText("Battle registered successfully.", { exact: true }),
  ).toBeVisible();

  expect(await storedIds(page, "confirmed")).toEqual(confirmedIds);

  await setScenario(page, "success");
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Battle complete", exact: true }),
  ).toBeVisible();

  expect(await storedIds(page, "pending")).toEqual([]);
  expect(await storedIds(page, "confirmed")).toEqual(confirmedIds);
  await checkSingleHistoryRecord(page);
});

test("shows a ranking error and recovers through Retry", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "pb:scenario",
      JSON.stringify("ranking-error"),
    );
  });

  await page.goto("/");

  const alert = page.getByRole("alert");

  await expect(alert).toContainText(
    "Could not load ranking. Please try again.",
    { timeout: 15_000 },
  );

  // A ranking failure must not disable the game or options.
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();

  await expect(
    page.getByRole("button", { name: "Options", exact: true }),
  ).toBeEnabled();

  await setScenario(page, "success");
  await alert.getByRole("button", { name: "Retry", exact: true }).click();

  const table = page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  });

  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(alert).toHaveCount(0);
});

test("updates ranking and history after match registration", async ({ page }) => {
  await page.goto("/?test");

  await expect(page.getByText("Page 1 of 5 · 24 records", {
    exact: true,
  })).toBeVisible();

  await completeBattle(page);

  await expect(page.getByText(
    "Battle registered successfully.",
    { exact: true },
  )).toBeVisible();

  await page.getByRole("button", {
    name: "Main Menu",
    exact: true,
  }).click();

  await expect(page.getByText("Page 1 of 5 · 25 records", {
    exact: true,
  })).toBeVisible();

  for (let index = 0; index < 4; index++) {
    await page.getByRole("button", {
      name: "Next",
      exact: true,
    }).click();

    await expect(page.getByText(
      `Page ${index + 2} of 5 · 25 records`,
      { exact: true },
    )).toBeVisible();

    await expect(page.getByRole("button", {
      name: "Refresh",
      exact: true,
    })).toBeEnabled();
  }

  const ranking = page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  });

  await expect(ranking.locator("tbody tr")).toHaveCount(5);
  await expect(ranking.locator("tbody tr").last()).toContainText("Captain");

  await page.getByRole("button", {
    name: "History",
    exact: true,
  }).click();

  const history = page.getByRole("table", {
    name: "History records",
    exact: true,
  });

  await expect(history.locator("tbody tr")).toHaveCount(1);
  await expect(history.locator("tbody tr")).toContainText("Captain");
});

test("keeps rankings separate for different gameplay configurations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toBeVisible();

  await page.getByRole("button", {
    name: "Options",
    exact: true,
  }).click();

  await page.getByLabel("Session duration (seconds)").fill("90");
  await page.getByRole("button", { name: "Save Options" }).click();

  await expect(page.getByText(
    "No scores for this configuration yet.",
    { exact: true },
  )).toBeVisible();

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toHaveCount(0);

  await page.getByRole("button", {
    name: "Options",
    exact: true,
  }).click();

  await page.getByLabel("Session duration (seconds)").fill("120");
  await page.getByRole("button", { name: "Save Options" }).click();

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toBeVisible();

  await expect(page.getByText("Page 1 of 5 · 24 records", {
    exact: true,
  })).toBeVisible();
});

test("keeps history visible when a delayed ranking request is interrupted", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toBeVisible();

  await setScenario(page, "slow");

  await page.getByRole("button", {
    name: "Refresh",
    exact: true,
  }).click();

  await expect(page.getByText("Updating records…", {
    exact: true,
  })).toBeVisible();

  await page.getByRole("button", {
    name: "History",
    exact: true,
  }).click();

  await expect(page.getByRole("heading", {
    name: "History",
    exact: true,
  })).toBeVisible();

  await expect(page.getByText(
    "No registered battles on this page yet.",
    { exact: true },
  )).toBeVisible();

  // Observe beyond the mock's 1,200 ms delay to detect late UI replacement.
  await page.waitForTimeout(1_500);

  await expect(page.getByRole("heading", {
    name: "History",
    exact: true,
  })).toBeVisible();

  await expect(page.getByRole("table", {
    name: "Ranking records",
    exact: true,
  })).toHaveCount(0);
});

test("preserves an earlier pending match while completing another battle", async ({
  page,
}) => {
  await page.goto("/?test");
  await setScenario(page, "offline");
  await completeBattle(page);

  const firstIds = await storedIds(page, "pending");
  expect(firstIds).toHaveLength(1);

  await page.getByRole("button", {
    name: "Main Menu",
    exact: true,
  }).click();

  await completeBattle(page);

  const bothIds = await storedIds(page, "pending");
  expect(bothIds).toHaveLength(2);
  expect(bothIds).toContain(firstIds[0]);
  expect(new Set(bothIds).size).toBe(2);

  const retry = page.getByRole("button", {
    name: "Retry pending",
    exact: true,
  });

  await expect(retry).toBeEnabled({ timeout: 15_000 });

  await setScenario(page, "success");
  await retry.click();

  await expect.poll(
    () => storedIds(page, "pending"),
    { timeout: 15_000 },
  ).toEqual([]);

  await expect.poll(
    async () => (await storedIds(page, "confirmed")).sort(),
    { timeout: 15_000 },
  ).toEqual([...bothIds].sort());

  await page.getByRole("button", {
    name: "Main Menu",
    exact: true,
  }).click();

  await page.getByRole("button", {
    name: "History",
    exact: true,
  }).click();

  const history = page.getByRole("table", {
    name: "History records",
    exact: true,
  });

  await expect(history.locator("tbody tr")).toHaveCount(2);
});