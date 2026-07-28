"use strict";

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const app = await electron.launch({
  args: [path.resolve(".")],
  env: { ...process.env, CHV1_TEST_MODE: "1", ELECTRON_DISABLE_SECURITY_WARNINGS: "1" }
});
const page = await app.firstWindow();
const rendererErrors = [];
page.on("pageerror", (error) => rendererErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") rendererErrors.push(message.text()); });

async function runtimeSnapshot() {
  return page.evaluate(async () => {
    const { getGameRuntime } = await import("./game/runtime-access.js");
    const runtime = getGameRuntime();
    return {
      status: runtime.gameState.status,
      gold: runtime.gameState.gold,
      inventory: [...runtime.gameState.inventory],
      upgraded: [...runtime.gameState.upgradedItemIds],
      currentNodeId: runtime.gameState.currentNodeId,
      completed: [...runtime.gameState.completedNodeIds],
      timeOut: runtime.itemController.getState("time-out")
    };
  });
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#map-screen").waitFor({ state: "visible" });

  await page.evaluate(async () => {
    const { getGameRuntime } = await import("./game/runtime-access.js");
    const runtime = getGameRuntime();
    runtime.gameState.inventory = ["time-out", "hourglass"];
    runtime.gameState.upgradedItemIds = [];
    runtime.gameState.gold = 1000;
    runtime.itemController.resetForRun();
    const shop = runtime.mapController.getMap().nodes.find((node) => node.type === "shop");
    if (!shop) throw new Error("Aucune boutique dans la carte de test.");
    runtime.gameState.moveToNode(shop.id);
    runtime.roomController.open(shop);
  });

  await page.locator("#shop-screen").waitFor({ state: "visible" });
  const beforeShop = await runtimeSnapshot();
  const firstCard = page.locator("#shop-stock-list .room-item-card").first();
  assert.ok(await firstCard.count(), "La boutique doit proposer au moins un objet.");
  const boughtName = (await firstCard.locator("h3").textContent())?.trim();
  await firstCard.locator("button").click();
  const afterBuy = await runtimeSnapshot();
  assert.equal(afterBuy.inventory.length, beforeShop.inventory.length + 1, "L’achat doit ajouter un objet.");
  assert.ok(afterBuy.gold < beforeShop.gold, "L’achat doit dépenser de l’or.");
  assert.equal(await page.locator("#shop-screen").isVisible(), true, "La boutique doit rester ouverte après l’achat.");
  assert.ok(!await page.locator("#shop-stock-list h3").allTextContents().then((values) => values.includes(boughtName)), "L’objet acheté doit disparaître du stock.");

  const rerollTextBefore = await page.locator("#shop-reroll-button").textContent();
  await page.locator("#shop-reroll-button").click();
  const rerollTextAfter = await page.locator("#shop-reroll-button").textContent();
  assert.notEqual(rerollTextAfter, rerollTextBefore, "Le coût de renouvellement doit progresser.");

  await page.locator("#shop-leave-button").click();
  await page.locator("#map-screen").waitFor({ state: "visible" });
  const afterShop = await runtimeSnapshot();
  assert.equal(afterShop.status, "map");
  assert.ok(afterShop.completed.includes(beforeShop.currentNodeId), "Quitter la boutique doit terminer sa case.");

  await page.evaluate(async () => {
    const { getGameRuntime } = await import("./game/runtime-access.js");
    const runtime = getGameRuntime();
    const state = runtime.itemController.ensureRuntimeState("time-out");
    state.available = false;
    state.remainingRechargeRounds = 1;
    const campfire = runtime.mapController.getMap().nodes.find((node) => node.type === "campfire");
    if (!campfire) throw new Error("Aucun feu de camp dans la carte de test.");
    runtime.gameState.moveToNode(campfire.id);
    runtime.roomController.open(campfire);
  });

  await page.locator("#campfire-screen").waitFor({ state: "visible" });
  await page.locator("#campfire-rest-button").click();
  await page.locator("#map-screen").waitFor({ state: "visible" });
  const afterRest = await runtimeSnapshot();
  assert.equal(afterRest.timeOut.available, true, "Le repos doit recharger Temps mort.");
  assert.equal(afterRest.timeOut.remainingRechargeRounds, 0);

  await page.evaluate(async () => {
    const { getGameRuntime } = await import("./game/runtime-access.js");
    const runtime = getGameRuntime();
    const campfire = runtime.mapController.getMap().nodes.find((node) => node.type === "campfire");
    runtime.gameState.moveToNode(campfire.id);
    runtime.roomController.open(campfire);
  });
  await page.locator("#campfire-upgrade-button").click();
  await page.locator("#campfire-upgrade-list").waitFor({ state: "visible" });
  const upgradeCard = page.locator("#campfire-upgrade-list .room-item-card").filter({ hasText: "Temps mort" }).first();
  assert.ok(await upgradeCard.count(), "Temps mort doit être proposé à l’amélioration.");
  await upgradeCard.locator("button", { hasText: "Améliorer" }).click();
  await page.locator("#map-screen").waitFor({ state: "visible" });
  const afterUpgrade = await runtimeSnapshot();
  assert.ok(afterUpgrade.upgraded.includes("time-out"), "L’amélioration doit être conservée dans l’état de partie.");

  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron shop and campfire flow test passed.");
} finally {
  await app.close();
}
