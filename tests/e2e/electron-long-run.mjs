"use strict";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const REPORT_DIR = path.resolve("playwright-report", "electron-long-run");
await fs.mkdir(REPORT_DIR, { recursive: true });

const app = await electron.launch({
  args: [path.resolve(".")],
  env: {
    ...process.env,
    CHV1_TEST_MODE: "1",
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
  }
});

const page = await app.firstWindow();
const context = page.context();
const rendererErrors = [];
const transitions = [];
let screenshotIndex = 0;

page.on("pageerror", (error) => rendererErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") rendererErrors.push(`console: ${message.text()}`);
});

await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

const SCREEN_IDS = [
  "map-screen",
  "encounter-screen",
  "event-screen",
  "reward-screen",
  "shop-screen",
  "campfire-screen",
  "phase-one-screen"
];

async function screenshot(label) {
  screenshotIndex += 1;
  const safe = label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  await page.screenshot({
    path: path.join(REPORT_DIR, `${String(screenshotIndex).padStart(2, "0")}-${safe}.png`),
    fullPage: true
  });
}

async function dismissItemChoiceDialogs() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const decline = page.locator(".item-choice-dialog__decline:visible").first();
    if (!(await decline.count())) return;
    await decline.click({ timeout: 2_000 });
  }
}

async function visibleScreen() {
  return page.evaluate((ids) => {
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element && !element.hidden && getComputedStyle(element).display !== "none") return id;
    }
    return null;
  }, SCREEN_IDS);
}

async function waitForScreenChange(previous, timeout = 5_000) {
  await page.waitForFunction(({ ids, previousId }) => {
    return ids.some((id) => {
      const element = document.getElementById(id);
      return id !== previousId && element && !element.hidden && getComputedStyle(element).display !== "none";
    });
  }, { ids: SCREEN_IDS, previousId: previous }, { timeout });
  await dismissItemChoiceDialogs();
  return visibleScreen();
}

async function failStuck(message) {
  await screenshot("blocked-state");
  const state = await page.evaluate((ids) => ({
    visible: ids.filter((id) => {
      const element = document.getElementById(id);
      return element && !element.hidden && getComputedStyle(element).display !== "none";
    }),
    activeDialogs: [...document.querySelectorAll("[role=dialog], .modal-screen, .item-choice-overlay")]
      .filter((element) => !element.hidden && getComputedStyle(element).display !== "none")
      .map((element) => ({ id: element.id, className: element.className }))
  }), SCREEN_IDS);
  throw new Error(`${message}\nÉtat visible : ${JSON.stringify(state)}`);
}

async function clickAndRequireTransition(locator, currentScreen, label) {
  try {
    await locator.waitFor({ state: "visible", timeout: 3_000 });
    await locator.click({ timeout: 3_000 });
    await dismissItemChoiceDialogs();
    const next = await waitForScreenChange(currentScreen, 5_000);
    transitions.push(`${currentScreen} -> ${next} (${label})`);
    return next;
  } catch (error) {
    await failStuck(`Transition bloquée après « ${label} » depuis ${currentScreen}: ${error.message}`);
  }
}

async function finishEncounter() {
  await dismissItemChoiceDialogs();
  const previous = "encounter-screen";
  await page.evaluate(() => {
    const video = document.getElementById("round-video");
    if (!video) throw new Error("Lecteur vidéo introuvable.");
    try {
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.max(0, video.duration - 0.01);
    } catch {}
    video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    video.dispatchEvent(new Event("ended", { bubbles: true }));
  });
  try {
    const next = await waitForScreenChange(previous, 5_000);
    transitions.push(`${previous} -> ${next} (fin vidéo forcée)`);
    return next;
  } catch (error) {
    await failStuck(`La rencontre ne se termine pas après l’événement ended: ${error.message}`);
  }
}

async function resolveCurrentScreen(screenId) {
  switch (screenId) {
    case "map-screen": {
      const accessible = page.locator("[data-node-id]:not([disabled])").first();
      assert.ok(await accessible.count(), "La carte doit proposer au moins une destination accessible.");
      return clickAndRequireTransition(accessible, screenId, "sélection d’une case accessible");
    }
    case "encounter-screen":
      return finishEncounter();
    case "event-screen":
      return clickAndRequireTransition(page.locator("#event-choice-list button:not([disabled])").first(), screenId, "choix d’événement");
    case "reward-screen":
      return clickAndRequireTransition(page.locator("#reward-choice-list button:not([disabled])").first(), screenId, "choix de récompense élite");
    case "shop-screen":
      return clickAndRequireTransition(page.locator("#shop-leave-button"), screenId, "sortie de boutique");
    case "campfire-screen":
      return clickAndRequireTransition(page.locator("#campfire-rest-button"), screenId, "repos au feu de camp");
    case "phase-one-screen":
      return clickAndRequireTransition(page.locator("#phase-one-primary-button"), screenId, "action principale de phase");
    default:
      await failStuck(`Écran inconnu ou aucun écran de jeu visible : ${screenId}`);
  }
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#map-screen").waitFor({ state: "visible", timeout: 10_000 });
  await screenshot("initial-map");

  let current = await visibleScreen();
  assert.equal(current, "map-screen");

  for (let step = 0; step < 18; step += 1) {
    await dismissItemChoiceDialogs();
    await screenshot(`step-${step}-${current}`);
    current = await resolveCurrentScreen(current);
    assert.ok(current, `Aucun écran visible après l’étape ${step}.`);
    if (["victory", "game-over"].includes(await page.evaluate(() => globalThis.__CHV1_GAME_RUNTIME__?.gameState?.status))) break;
  }

  await screenshot("final-state");
  assert.ok(transitions.length >= 8, `Le scénario n’a effectué que ${transitions.length} transitions.`);
  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées :\n${rendererErrors.join("\n")}`);
  console.log(`Electron long-run E2E passed with ${transitions.length} transitions.`);
  console.log(transitions.join("\n"));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.tracing.stop({ path: path.join(REPORT_DIR, "trace.zip") });
  await app.close();
}
