import { test, expect } from "@playwright/test";

test.describe("Chat Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/chat");

    await expect(page).toHaveURL(/login/);
  });

  test("should load chat page structure", async ({ page }) => {
    await page.goto("/chat");

    // Page should not have server errors
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test("should handle tool parameter in URL", async ({ page }) => {
    await page.goto("/chat?tool=speech");

    // Should redirect to login (requires auth)
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Dashboard Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/login/);
  });

  test("should load dashboard without errors", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveTitle(/500|error/i);
  });
});

test.describe("Settings Pages", () => {
  test("should redirect settings to login", async ({ page }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/login/);
  });

  test("should redirect API settings to login", async ({ page }) => {
    await page.goto("/settings/api");

    await expect(page).toHaveURL(/login/);
  });

  test("should redirect notifications settings to login", async ({ page }) => {
    await page.goto("/settings/notifications");

    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Research Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/research");

    await expect(page).toHaveURL(/login/);
  });
});
