"use strict";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const reportDir = path.resolve("playwright-report", "defeat-blessing");
await fs.mkdir(reportDir, { recursive: true });

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

async function visible(selector, timeout = 7_500) {
  await page.locator(selector).waitFor({ state: "visible", timeout });
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => Boolean(globalThis.__CHV1_PHASE_ONE__?.processDefeat));

  const initial = await page.evaluate(() => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    return {
      status: runtime?.gameState?.status,
      loopCount: globalThis.__CHV1_PHASE_ONE__.controller.getMeta().loopCount
    };
  });

  await page.evaluate(async () => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    runtime.gameState.inventory = runtime.gameState.inventory.filter((id) => id !== "last-stand" && id !== "delayed-protection");
    runtime.gameState.nextEncounterProtectionArmed = false;
    await globalThis.__CHV1_PHASE_ONE__.processDefeat();
  });

  await visible("#phase-one-screen");
  await visible("#phase-one-primary-button");
  assert.match(await page.locator("#phase-one-title").textContent(), /espace blanc/i);
  assert.equal(await page.evaluate(() => globalThis.__CHV1_GAME_RUNTIME__.gameState.status), "game-over");
  await page.screenshot({ path: path.join(reportDir, "01-white-space.png"), fullPage: true });

  await page.locator("#phase-one-primary-button").click();

  await page.waitForFunction(() => {
    const status = globalThis.__CHV1_GAME_RUNTIME__?.gameState?.status;
    return status === "blessing" || status === "map";
  }, null, { timeout: 7_500 });

  const statusAfterWake = await page.evaluate(() => globalThis.__CHV1_GAME_RUNTIME__.gameState.status);
  if (statusAfterWake === "blessing") {
    await visible(".blessing-choice-card");
    const choices = page.locator(".blessing-choice-card");
    assert.ok(await choices.count() >= 1, "Au moins une bénédiction doit être proposée.");
    await page.screenshot({ path: path.join(reportDir, "02-blessing-choice.png"), fullPage: true });
    await choices.first().click();
  }

  await visible("#map-screen");
  await page.waitForFunction(() => globalThis.__CHV1_GAME_RUNTIME__?.gameState?.status === "map", null, { timeout: 7_500 });
  await page.screenshot({ path: path.join(reportDir, "03-map-after-blessing.png"), fullPage: true });

  const finalState = await page.evaluate(() => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    const meta = globalThis.__CHV1_PHASE_ONE__.controller.getMeta();
    return {
      status: runtime.gameState.status,
      currentNodeId: runtime.gameState.currentNodeId,
      blessingId: runtime.gameState.activeBlessingId,
      loopCount: meta.loopCount,
      disabledVisibleButtons: [...document.querySelectorAll("#phase-one-screen button")].filter((button) => !button.hidden && button.disabled).length,
      accessibleNodes: document.querySelectorAll("[data-node-id]:not([disabled])").length
    };
  });

  assert.equal(finalState.status, "map");
  assert.ok(finalState.currentNodeId, "Une nouvelle partie doit avoir une case courante.");
  assert.ok(finalState.loopCount > initial.loopCount, "La boucle doit progresser après la défaite.");
  assert.ok(finalState.accessibleNodes > 0, "La carte doit rester jouable après le choix de bénédiction.");
  assert.equal(rendererErrors.length, 0, `Erreurs renderer : ${rendererErrors.join(" | ")}`);

  await fs.writeFile(path.join(reportDir, "state.json"), JSON.stringify({ initial, finalState, rendererErrors }, null, 2));
  console.log("Electron defeat/blessing recovery E2E test passed.");
} finally {
  await app.close();
}
