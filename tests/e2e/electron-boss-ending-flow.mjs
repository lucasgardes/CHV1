"use strict";

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const app = await electron.launch({
  args: [path.resolve(".")],
  env: { ...process.env, CHV1_TEST_MODE:"1", ELECTRON_DISABLE_SECURITY_WARNINGS:"1" }
});

const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => Boolean(globalThis.__CHV1_PHASE_ONE__?.controller && globalThis.__CHV1_GAME_RUNTIME__?.gameState));

  const before = await page.evaluate(() => {
    const runtime = globalThis.__CHV1_GAME_RUNTIME__;
    runtime.gameState.setStatus("encounter");
    const result = globalThis.__CHV1_PHASE_ONE__.controller.completeBoss();
    return {
      ending: result.ending,
      status: runtime.gameState.status,
      loopCount: result.meta.loopCount,
      victories: result.meta.victories
    };
  });

  assert.equal(before.ending, "escape", "La Clé du dernier acte possédée en mode test doit produire la fin d’évasion.");
  assert.equal(before.status, "victory");
  assert.ok(before.victories >= 1);

  await page.locator("#phase-one-screen").waitFor({ state:"visible", timeout:5_000 });
  assert.equal(await page.locator("#phase-one-title").textContent(), "L’évasion");
  assert.match(await page.locator("#phase-one-message").textContent(), /extérieur|sortie|porte/i);

  await page.screenshot({ path:"playwright-report/boss-ending.png", fullPage:true });
  await page.locator("#phase-one-primary-button").click();

  await page.waitForFunction(() => {
    const map = document.getElementById("map-screen");
    const phase = document.getElementById("phase-one-screen");
    return (map && !map.hidden) || (phase && !phase.hidden && document.querySelectorAll(".blessing-choice-card").length > 0);
  }, null, { timeout:5_000 });

  if (await page.locator(".blessing-choice-card").count()) {
    await page.locator(".blessing-choice-card").first().click();
    await page.locator("#map-screen").waitFor({ state:"visible", timeout:5_000 });
  }

  const after = await page.evaluate(() => ({
    status: globalThis.__CHV1_GAME_RUNTIME__.gameState.status,
    accessible: document.querySelectorAll("[data-node-id]:not([disabled])").length,
    phaseHidden: document.getElementById("phase-one-screen").hidden
  }));

  assert.equal(after.status, "map");
  assert.ok(after.accessible > 0, "Une nouvelle partie doit rester jouable après la fin du boss.");
  assert.equal(after.phaseHidden, true);
  assert.deepEqual(errors, [], `Erreurs renderer détectées : ${errors.join(" | ")}`);
  console.log("Electron boss ending flow passed.");
} finally {
  await app.close();
}
