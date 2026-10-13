import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("displays the main menu and navigation", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Pirate Battle", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Options", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Ranking", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
});

test("starts a battle and displays the game canvas", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("game-canvas")).toBeVisible({
    timeout: 15_000,
  });

  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).not.toBeVisible();
});

test("loads ranking records and navigates between pages", async ({ page }) => {
  const table = page.getByRole("table", { name: "Ranking records", exact: true });
  const previous = page.getByRole("button", {
    name: "Previous",
    exact: true,
  });
  const next = page.getByRole("button", { name: "Next", exact: true });

  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(table.locator("tbody tr").first()).toContainText("Anne Bonny");
  await expect(table.locator("tbody tr").first().locator("td").first())
    .toHaveText("1");
  await expect(previous).toBeDisabled();

  await next.click();

  await expect(table.locator("tbody tr").first()).toContainText("Iron Sail");
  await expect(table.locator("tbody tr").first().locator("td").first())
    .toHaveText("6");
  await expect(previous).toBeEnabled();

  await previous.click();

  await expect(table.locator("tbody tr").first()).toContainText("Anne Bonny");
  await expect(table.locator("tbody tr").first().locator("td").first())
    .toHaveText("1");
  await expect(previous).toBeDisabled();
});

test("shows an empty history for a new player", async ({ page }) => {
  await page.getByRole("button", { name: "History", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();

  await expect(page.getByText(/0 records/)).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();

  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});