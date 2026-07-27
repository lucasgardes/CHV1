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

try {
  await page.waitForLoadState("domcontentloaded");
  await visible("#map-screen");

  const setup = await page.evaluate(async () => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    if (!runtime?.gameState || !runtime?.mapController || !runtime?.encounterController) {
      throw new Error("Runtime du jeu indisponible pour le test d’élite.");
    }

    const eliteNode = runtime.mapController.getMap().nodes.find((node) => node.type === "elite" && node.encounterId);
    if (!eliteNode) throw new Error("Aucune rencontre élite disponible sur la carte.");

    runtime.gameState.moveToNode(eliteNode.id);
    runtime.gameState.setCurrentEncounter({ nodeId: eliteNode.id, encounterId: eliteNode.encounterId, type: "elite" });
    runtime.gameState.setStatus("encounter");
    runtime.encounterController.currentEncounter = {
      id: eliteNode.encounterId,
      type: "elite",
      title: eliteNode.title || "Élite de test",
      rewardGold: 80,
      effectiveRewardGold: 80,
      doubleBetAccepted: false
    };

    const beforeInventory = [...runtime.gameState.inventory];
    const beforeGold = runtime.gameState.gold;
    await runtime.encounterController.complete();
    return { beforeInventory, beforeGold, eliteNodeId: eliteNode.id };
  });

  await visible("#reward-screen");
  const firstButtons = page.locator("#reward-choice-list button:not([disabled])");
  assert.ok(await firstButtons.count() >= 2, "La première étape doit proposer au moins or et objet.");

  const firstLabels = await firstButtons.allTextContents();
  await firstButtons.first().click();

  // Le design attendu impose deux choix consécutifs. Après le premier choix,
  // l’écran de récompense doit rester ouvert avec une nouvelle proposition.
  await visible("#reward-screen", 5_000);
  const secondButtons = page.locator("#reward-choice-list button:not([disabled])");
  assert.ok(await secondButtons.count() >= 2, "La seconde étape doit de nouveau proposer or et objet.");

  const secondLabels = await secondButtons.allTextContents();
  const firstItemLabel = firstLabels.find((label) => !/or/i.test(label)) ?? null;
  const secondItemLabel = secondLabels.find((label) => !/or/i.test(label)) ?? null;
  if (firstItemLabel && secondItemLabel) {
    assert.notEqual(secondItemLabel, firstItemLabel, "Le second objet proposé doit être différent du premier.");
  }

  await secondButtons.last().click();
  await visible("#map-screen", 5_000);
  assert.equal(await page.locator("#reward-screen").isHidden(), true, "L’écran de récompense doit se fermer après le second choix.");

  const result = await page.evaluate(() => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    return {
      status: runtime.gameState.status,
      gold: runtime.gameState.gold,
      inventory: [...runtime.gameState.inventory],
      currentEncounter: runtime.gameState.currentEncounter
    };
  });

  assert.equal(result.status, "map");
  assert.equal(result.currentEncounter, null);
  assert.ok(
    result.gold > setup.beforeGold || result.inventory.length > setup.beforeInventory.length,
    "Les deux étapes doivent accorder au moins une récompense réelle."
  );
  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron elite double reward E2E test passed.");
} finally {
  await app.close();
}
