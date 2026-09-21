// The Gemini tab has to name the `.env` file this launch actually reads.
//
// It used to say a bare `.env`, which reads as "the obvious one" and there is
// no obvious one: a terminal launch reads the launch directory, an icon launch
// reads `~/.env` because an icon has no launch directory at all (#2626).
// The path comes from `/api/health`, so the mock supplies it here.

import { test, expect } from "@playwright/test";
import { mockAllApis } from "../fixtures/api";

const ENV_FILE_PATH = "/Users/example/.env";

test.describe("Settings → Gemini", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
  });

  test("names the .env path the server reported", async ({ page }) => {
    // Registered AFTER mockAllApis: Playwright checks the last-registered
    // route first, so this replaces the fixture's own /api/health.
    await page.route(
      (url) => url.pathname === "/api/health",
      (route) => route.fulfill({ json: { status: "OK", geminiAvailable: false, geminiEnvFilePath: ENV_FILE_PATH, sandboxEnabled: false } }),
    );

    await page.goto("/chat");
    await expect(page.getByTestId("app-title")).toBeVisible();

    // The badge on the gear is the missing-key signal; the tab it leads to
    // is where the guidance lives.
    await expect(page.getByTestId("settings-gemini-badge")).toBeVisible();
    await page.getByTestId("settings-btn").click();

    const warning = page.getByTestId("settings-gemini-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(ENV_FILE_PATH);
  });

  test("falls back to the bare filename when health carries no path", async ({ page }) => {
    await page.route(
      (url) => url.pathname === "/api/health",
      (route) => route.fulfill({ json: { status: "OK", geminiAvailable: false, sandboxEnabled: false } }),
    );

    await page.goto("/chat");
    await expect(page.getByTestId("app-title")).toBeVisible();
    await page.getByTestId("settings-btn").click();
    await expect(page.getByTestId("settings-gemini-warning")).toContainText(".env");
  });
});
