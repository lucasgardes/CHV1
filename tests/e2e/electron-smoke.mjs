"use strict";

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const app = await electron.launch({
  args: [path.resolve(".")],
  env: {
    ...process.env,
    CHV1_TEST_MODE: "1",
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
  }
});

const page = await app.firstWindow();
const rendererErrors = [];
page.on("pageerror", (error) => rendererErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") rendererErrors.push(message.text());
});

async function expectVisible(selector) {
  await page.locator(selector).waitFor({ state: "visible", timeout: 10_000 });
}

try {
  await page.waitForLoadState("domcontentloaded");
  assert.equal(await page.title(), "CHV1 — Video Ascension");

  await expectVisible("#map-screen");
  assert.equal(await page.locator("#map-screen").getAttribute("hidden"), null);
  await expectVisible("#map-node-list");
  assert.ok(await page.locator("[data-node-id]").count() > 0, "La carte doit afficher des cases.");

  await page.locator("#collection-navigation-tab").click();
  await expectVisible("#collection-screen");
  assert.equal(await page.locator("#map-screen").isHidden(), true);

  await page.locator("#statistics-navigation-tab").click();
  await expectVisible("#statistics-screen");

  await page.locator("#map-navigation-tab").click();
  await expectVisible("#map-screen");

  await page.locator("#open-settings-button").click();
  await expectVisible("#settings-panel");
  await page.locator("#close-settings-button").click();
  assert.equal(await page.locator("#settings-panel").isHidden(), true);

  const accessibleNode = page.locator("[data-node-id]:not([disabled])").first();
  assert.ok(await accessibleNode.count(), "Une destination doit être accessible.");
  await accessibleNode.click();

  await page.waitForFunction(() => {
    const screens = ["encounter-screen", "event-screen", "shop-screen", "campfire-screen", "reward-screen", "phase-one-screen"];
    return screens.some((id) => {
      const element = document.getElementById(id);
      return element && !element.hidden;
    });
  }, null, { timeout: 10_000 });

  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron E2E smoke test passed.");
} finally {
  await app.close();
}
