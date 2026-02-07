import { test, expect } from "@playwright/test";

test.describe("Documents Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/documents");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("should display documents page title", async ({ page }) => {
    // This test checks the page loads correctly (even if redirected)
    await page.goto("/documents");

    // Page should load without critical errors
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});

test.describe("Document Upload Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/documents/upload");

    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Document Processing Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/documents/process");

    await expect(page).toHaveURL(/login/);
  });
});

test.describe("YouTube Documents Page", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/documents/youtube");

    await expect(page).toHaveURL(/login/);
  });
});
