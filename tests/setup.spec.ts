import  { test, expect } from '@playwright/test';

test('loads the application and updates the counter', async ({page}) => {
  await page.goto('/');

  const counter = page.getByRole('button', {
    name: 'Count is 0',
    exact: true,
  });

  await expect(counter).toBeVisible();
  await counter.click();

  await expect(
    page.getByRole('button', {name: 'Count is 1', exact: true}),
  ).toBeVisible();

});