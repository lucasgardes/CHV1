"use strict";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const reportDir = path.resolve("playwright-report/event-result-flow");
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

async function visibleScreen() {
  return page.evaluate(() => {
    const ids = [
      "map-screen", "encounter-screen", "event-screen", "reward-screen",
      "shop-screen", "campfire-screen", "phase-one-screen"
    ];
    return ids.find((id) => {
      const element = document.getElementById(id);
      return element && !element.hidden;
    }) ?? null;
  });
}

async function finishCurrentScreen(screen) {
  if (screen === "encounter-screen") {
    await page.locator("#round-video").evaluate((video) => {
      video.dispatchEvent(new Event("ended"));
    });
    return;
  }
  if (screen === "reward-screen") {
    const choice = page.locator("#reward-choice-list button:not([disabled])").first();
    if (await choice.count()) await choice.click();
    return;
  }
  if (screen === "shop-screen") {
    await page.locator("#shop-leave-button").click();
    return;
  }
  if (screen === "campfire-screen") {
    await page.locator("#campfire-rest-button").click();
    return;
  }
  if (screen === "phase-one-screen") {
    const blessing = page.locator(".blessing-choice-card:not([disabled])").first();
    if (await blessing.count()) await blessing.click();
    else {
      const primary = page.locator("#phase-one-primary-button:not([hidden]):not([disabled])");
      if (await primary.count()) await primary.click();
    }
  }
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#map-screen").waitFor({ state: "visible", timeout: 10_000 });

  let foundEvent = false;
  for (let step = 0; step < 30 && !foundEvent; step += 1) {
    const screen = await visibleScreen();
    if (screen === "event-screen") {
      foundEvent = true;
      break;
    }

    if (screen === "map-screen") {
      const eventNode = page.locator('[data-node-id]:not([disabled]).map-node-event').first();
      const anyNode = page.locator("[data-node-id]:not([disabled])").first();
      const target = await eventNode.count() ? eventNode : anyNode;
      assert.ok(await target.count(), `Aucune case accessible à l'étape ${step}.`);
      await target.click();
    } else {
      await finishCurrentScreen(screen);
    }

    await page.waitForTimeout(120);
  }

  assert.equal(foundEvent, true, "Aucun événement n'a été atteint pendant le parcours E2E.");
  await page.screenshot({ path: path.join(reportDir, "01-event-before-choice.png"), fullPage: true });

  const initial = await page.evaluate(() => ({
    title: document.getElementById("event-title")?.textContent ?? "",
    description: document.getElementById("event-description")?.textContent ?? "",
    gold: document.getElementById("gold-value")?.textContent ?? "",
    choices: [...document.querySelectorAll("#event-choice-list button")].map((button) => ({
      text: button.textContent,
      disabled: button.disabled
    }))
  }));
  assert.ok(initial.choices.some((choice) => !choice.disabled), "L'événement doit proposer au moins un choix actif.");

  const choice = page.locator("#event-choice-list .event-choice-button:not([disabled]):not(.secondary-button)").first();
  assert.ok(await choice.count(), "Aucun choix principal actif n'est disponible.");
  const selectedLabel = (await choice.textContent())?.trim() ?? "";
  await choice.click();

  await page.waitForFunction(() => {
    const screen = document.getElementById("event-screen");
    const title = document.getElementById("event-title");
    const continueButton = [...document.querySelectorAll("#event-choice-list button")]
      .find((button) => button.textContent?.includes("Continuer vers la carte"));
    return screen && !screen.hidden && title?.textContent === "Résultat" && Boolean(continueButton);
  }, null, { timeout: 5_000 });

  const result = await page.evaluate(() => ({
    screenStillVisible: !document.getElementById("event-screen")?.hidden,
    title: document.getElementById("event-title")?.textContent ?? "",
    description: document.getElementById("event-description")?.textContent ?? "",
    continueLabel: [...document.querySelectorAll("#event-choice-list button")]
      .find((button) => button.textContent?.includes("Continuer vers la carte"))?.textContent ?? ""
  }));

  assert.equal(result.screenStillVisible, true, "L'événement ne doit pas revenir immédiatement à la carte.");
  assert.equal(result.title, "Résultat");
  assert.ok(result.description.trim().length > 0, "Le résultat doit décrire la récompense ou le malus appliqué.");
  assert.notEqual(result.description, initial.description, "Le texte de résultat doit remplacer la description initiale.");
  assert.match(result.continueLabel, /Continuer vers la carte/);

  await page.screenshot({ path: path.join(reportDir, "02-event-result.png"), fullPage: true });
  await page.getByRole("button", { name: "Continuer vers la carte" }).click();
  await page.locator("#map-screen").waitFor({ state: "visible", timeout: 5_000 });

  const finalState = await page.evaluate(() => ({
    mapVisible: !document.getElementById("map-screen")?.hidden,
    eventHidden: document.getElementById("event-screen")?.hidden === true,
    accessibleNodes: document.querySelectorAll("[data-node-id]:not([disabled])").length
  }));
  assert.equal(finalState.mapVisible, true);
  assert.equal(finalState.eventHidden, true);
  assert.ok(finalState.accessibleNodes > 0, "La carte doit rester jouable après l'événement.");
  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);

  await fs.writeFile(path.join(reportDir, "summary.json"), JSON.stringify({ selectedLabel, initial, result, finalState }, null, 2));
  console.log("Electron event result feedback flow passed.");
} finally {
  await app.close();
}
