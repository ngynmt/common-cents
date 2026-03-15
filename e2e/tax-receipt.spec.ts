import { test, expect } from "@playwright/test";

test.describe("Tax Receipt Flow", () => {
  test("shows the form on initial load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Where do your tax dollars go?")).toBeVisible();
    await expect(page.getByLabel("Annual Gross Income")).toBeVisible();
    await expect(page.getByRole("button", { name: "See Where Your Money Goes" })).toBeVisible();
  });

  test("submit button is disabled without income", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "See Where Your Money Goes" });
    await expect(button).toBeDisabled();
  });

  test("submitting the form shows the tax receipt", async ({ page }) => {
    await page.goto("/");

    // Fill in income
    await page.getByLabel("Annual Gross Income").fill("75000");

    // Submit
    await page.getByRole("button", { name: "See Where Your Money Goes" }).click();

    // Receipt should appear — look for spending category content
    await expect(page.getByText("Your Federal Tax Receipt")).toBeVisible({ timeout: 10000 });

    // URL should update with params
    await expect(page).toHaveURL(/income=75000/);
    await expect(page).toHaveURL(/filing=single/);
  });

  test("selecting a different filing status works", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Annual Gross Income").fill("100000");
    await page.getByRole("radio", { name: "Married" }).click();
    await page.getByRole("button", { name: "See Where Your Money Goes" }).click();

    await expect(page.getByText("Your Federal Tax Receipt")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/filing=married/);
  });

  test("clicking the header returns to the form", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Annual Gross Income").fill("50000");
    await page.getByRole("button", { name: "See Where Your Money Goes" }).click();
    await expect(page.getByText("Your Federal Tax Receipt")).toBeVisible({ timeout: 10000 });

    // Click the "Common Cents" header to go back
    await page.getByRole("button", { name: "Common Cents" }).click();

    await expect(page.getByText("Where do your tax dollars go?")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("URL State Persistence", () => {
  test("navigating to URL with params shows the receipt directly", async ({ page }) => {
    await page.goto("/?income=90000&filing=single");

    // Should skip the form and show the receipt
    await expect(page.getByText("Your Federal Tax Receipt")).toBeVisible({ timeout: 10000 });
  });

  test("navigating to URL with married filing status works", async ({ page }) => {
    await page.goto("/?income=120000&filing=married");

    await expect(page.getByText("Your Federal Tax Receipt")).toBeVisible({ timeout: 10000 });
  });

  test("invalid URL params show the form instead", async ({ page }) => {
    await page.goto("/?income=abc&filing=invalid");

    // Should show the form, not the receipt
    await expect(page.getByText("Where do your tax dollars go?")).toBeVisible();
  });
});
