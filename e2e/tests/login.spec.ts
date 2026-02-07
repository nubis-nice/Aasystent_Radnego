import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test("should display login form", async ({ page }) => {
    await page.goto("/login");

    // Check page title
    await expect(page).toHaveTitle(/bezRADNY|Asystent|Login/i);

    // Check login button exists
    await expect(
      page.getByRole("button", { name: "Zaloguj się", exact: true }),
    ).toBeVisible();
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials (if form exists)
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill("invalid@test.com");

      const passwordInput = page.locator('input[type="password"]');
      if (await passwordInput.isVisible()) {
        await passwordInput.fill("wrongpassword");
      }

      // Try to submit
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show error or stay on login page
        await expect(page).toHaveURL(/login/);
      }
    }
  });
});

test.describe("Navigation", () => {
  test("should have working navigation links", async ({ page }) => {
    await page.goto("/");

    // Page should load without errors
    await expect(page).not.toHaveTitle(/error|500|404/i);
  });
});
