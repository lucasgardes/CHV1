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

async function visible(selector, timeout = 10_000) {
  await page.locator(selector).waitFor({ state: "visible", timeout });
}

async function configureInventory(itemIds) {
  await page.evaluate((ids) => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    if (!runtime?.gameState || !runtime?.itemController) throw new Error("Runtime de jeu indisponible.");
    runtime.gameState.inventory = [...ids];
    runtime.gameState.upgradedItemIds = [];
    runtime.itemController.resetForRun();
  }, itemIds);
}

async function enterNormalEncounter() {
  await visible("#map-screen");
  const normal = page.locator(".map-node-normal:not([disabled])").first();
  assert.ok(await normal.count(), "Une rencontre normale accessible est requise pour le test d’objets.");
  await normal.click();
  await visible("#encounter-screen");
  await visible("#active-item-list");
}

try {
  await page.waitForLoadState("domcontentloaded");
  await visible("#map-screen");

  await configureInventory([
    "hourglass",
    "shortcut",
    "emergency-button",
    "smoke-screen",
    "silencer",
    "utility-belt"
  ]);

  await enterNormalEncounter();

  const buttons = page.locator("#active-item-list .active-item-button");
  assert.equal(await buttons.count(), 5, "Les cinq objets activables doivent être affichés.");
  assert.equal(await buttons.nth(0).isDisabled(), false);
  assert.equal(await buttons.nth(1).isDisabled(), false);
  assert.equal(await buttons.nth(2).isDisabled(), false);
  assert.equal(await buttons.nth(3).isDisabled(), false, "La Ceinture utilitaire doit rendre un quatrième emplacement utilisable.");
  assert.equal(await buttons.nth(4).isDisabled(), true, "Le cinquième objet activable doit rester hors ceinture.");

  const beforeHourglass = await page.locator("#round-video").evaluate((video) => video.currentTime);
  await page.locator('[data-item-id="hourglass"]').click();
  await page.waitForFunction((before) => document.querySelector("#round-video").currentTime > before, beforeHourglass, { timeout: 5_000 });

  const afterHourglass = await page.locator("#round-video").evaluate((video) => video.currentTime);
  assert.ok(afterHourglass > beforeHourglass, "Le Sablier doit avancer réellement la vidéo.");
  assert.match(await page.locator('[data-item-id="hourglass"]').textContent(), /recharge|actif|utilisé|indisponible/i);

  const beforeShortcut = await page.locator("#round-video").evaluate((video) => video.currentTime);
  await page.locator('[data-item-id="shortcut"]').click();
  await page.waitForFunction((before) => document.querySelector("#round-video").currentTime > before, beforeShortcut, { timeout: 5_000 });

  await page.locator('[data-item-id="emergency-button"]').click();
  await visible("#map-screen", 5_000);
  assert.equal(await page.locator("#encounter-screen").isHidden(), true, "Le Bouton d’urgence doit fermer la rencontre.");

  const runtimeState = await page.evaluate(() => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    return {
      status: runtime.gameState.status,
      inventory: [...runtime.gameState.inventory],
      currentEncounter: runtime.gameState.currentEncounter
    };
  });
  assert.equal(runtimeState.status, "map");
  assert.equal(runtimeState.inventory.includes("emergency-button"), false, "Le Bouton d’urgence doit être consommé.");
  assert.equal(runtimeState.currentEncounter, null);

  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron item interaction E2E test passed.");
} finally {
  await app.close();
}
