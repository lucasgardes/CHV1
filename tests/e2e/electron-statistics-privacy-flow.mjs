"use strict";

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "chv1-stats-e2e-"));
const userData = path.join(tempRoot, "user-data");
await mkdir(userData, { recursive: true });

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await writeJson(path.join(userData, "media-settings.json"), {
  schemaVersion: 1,
  libraryPath: path.join(userData, "media"),
  retainDetailedHistory: true
});

async function launch() {
  const app = await electron.launch({
    args: [path.resolve("."), `--user-data-dir=${userData}`],
    env: {
      ...process.env,
      CHV1_TEST_MODE: "1",
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
    }
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.waitForLoadState("domcontentloaded");
  return { app, page, errors };
}

const alpha = {
  playbackContext: "run",
  videoId: "alpha-video",
  title: "Alpha Session",
  videoType: "normal",
  themes: ["tease"],
  performers: ["alice"],
  durationSeconds: 120,
  difficulty: "normal"
};
const beta = {
  playbackContext: "event",
  videoId: "beta-video",
  title: "Beta Boss",
  videoType: "boss",
  themes: ["boss"],
  performers: ["betty"],
  durationSeconds: 180,
  difficulty: "hard"
};

let session = await launch();
try {
  const { page, errors } = session;

  await page.evaluate(async ({ alphaEvent, betaEvent }) => {
    const record = (event) => globalThis.chv1Playback.record(event);
    await record({ ...alphaEvent, type: "start", at: "2026-01-01T10:00:00.000Z" });
    await record({ ...alphaEvent, type: "item-used", itemId: "hourglass", at: "2026-01-01T10:00:20.000Z" });
    await record({ ...alphaEvent, type: "win", watchSeconds: 110, progressPercent: 100, itemIds: ["hourglass"], itemCount: 1, firstItemUseSeconds: 20, at: "2026-01-01T10:02:00.000Z" });
    await record({ ...alphaEvent, type: "start", at: "2026-01-02T10:00:00.000Z" });
    await record({ ...alphaEvent, type: "loss", watchSeconds: 60, progressPercent: 50, itemIds: [], itemCount: 0, at: "2026-01-02T10:01:00.000Z" });
    await record({ ...betaEvent, type: "start", at: "2026-01-03T10:00:00.000Z" });
    await record({ ...betaEvent, type: "item-used", itemId: "shortcut", at: "2026-01-03T10:00:30.000Z" });
    await record({ ...betaEvent, type: "item-used", itemId: "hourglass", at: "2026-01-03T10:00:40.000Z" });
    await record({ ...betaEvent, type: "loss", watchSeconds: 150, progressPercent: 83, itemIds: ["shortcut", "hourglass"], itemCount: 2, firstItemUseSeconds: 30, at: "2026-01-03T10:03:00.000Z" });
  }, { alphaEvent: alpha, betaEvent: beta });

  const summary = await page.evaluate(() => globalThis.chv1VideoStats.get());
  assert.equal(summary.global.totalStarted, 3);
  assert.equal(summary.global.totalCompleted, 3);
  assert.equal(summary.global.totalWins, 1);
  assert.equal(summary.global.totalLosses, 2);
  assert.equal(summary.global.totalItemsUsed, 3);
  assert.equal(summary.global.totalWatchSeconds, 320);
  assert.equal(summary.mostViewed[0].id, "alpha-video");
  assert.equal(summary.mostItemsUsed[0].id, "beta-video");
  assert.equal(summary.bestWinrate[0].id, "alpha-video");
  assert.equal(summary.worstWinrate[0].id, "beta-video");

  await page.locator("#statistics-navigation-tab").click();
  await page.locator("#statistics-screen").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("#statistics-summary article").length >= 8);
  const summaryText = await page.locator("#statistics-summary").innerText();
  assert.match(summaryText, /Vidéos lancées\s*3/i);
  assert.match(summaryText, /Victoires\s*1/i);
  assert.match(summaryText, /Défaites\s*2/i);
  assert.match(summaryText, /Objets utilisés\s*3/i);
  assert.match(await page.locator("#statistics-rankings").innerText(), /Alpha Session/);
  assert.match(await page.locator("#statistics-rankings").innerText(), /Beta Boss/);

  await page.locator("#statistics-rankings .statistics-row", { hasText: "Beta Boss" }).first().click();
  const detailText = await page.locator("#statistics-details").innerText();
  assert.match(detailText, /Beta Boss/);
  assert.match(detailText, /Lancements\s*1/i);
  assert.match(detailText, /Objets utilisés\s*2/i);
  assert.match(detailText, /hard/i);
  assert.match(detailText, /shortcut|hourglass/i);

  await page.locator("#open-settings-button").click();
  const privacy = page.locator("#retain-detailed-history");
  await privacy.waitFor({ state: "visible" });
  assert.equal(await privacy.isChecked(), true);

  let recent = await page.evaluate(() => globalThis.chv1Playback.recentSessions());
  assert.equal(recent.detailed.length, 8);
  assert.deepEqual(recent.recentVideoIds, ["beta-video", "alpha-video"]);

  await privacy.uncheck();
  await page.waitForFunction(async () => (await globalThis.chv1Media.getSettings()).retainDetailedHistory === false);
  await page.evaluate((alphaEvent) => globalThis.chv1Playback.record({ ...alphaEvent, type: "start", at: "2026-01-04T10:00:00.000Z" }), alpha);
  recent = await page.evaluate(() => globalThis.chv1Playback.recentSessions());
  assert.deepEqual(recent.detailed, [], "La désactivation doit purger l’historique détaillé au prochain enregistrement.");
  assert.deepEqual(recent.recentVideoIds, ["alpha-video", "beta-video"], "La liste anti-répétition doit rester disponible.");

  const statsAfterPrivacy = await page.evaluate(() => globalThis.chv1VideoStats.get());
  assert.equal(statsAfterPrivacy.global.totalStarted, 4, "Les statistiques agrégées doivent rester actives quand l’historique détaillé est désactivé.");
  assert.deepEqual(errors, [], `Erreurs renderer détectées : ${errors.join(" | ")}`);
} finally {
  await session.app.close();
}

session = await launch();
try {
  const { page, errors } = session;
  await page.locator("#open-settings-button").click();
  const privacy = page.locator("#retain-detailed-history");
  await privacy.waitFor({ state: "visible" });
  assert.equal(await privacy.isChecked(), false, "Le réglage de confidentialité doit persister après relance.");

  const recent = await page.evaluate(() => globalThis.chv1Playback.recentSessions());
  assert.deepEqual(recent.detailed, []);
  assert.deepEqual(recent.recentVideoIds, ["alpha-video", "beta-video"]);

  const stats = await page.evaluate(() => globalThis.chv1VideoStats.get());
  assert.equal(stats.global.totalStarted, 4);
  assert.equal(stats.global.totalCompleted, 3);

  await privacy.check();
  await page.waitForFunction(async () => (await globalThis.chv1Media.getSettings()).retainDetailedHistory === true);
  await page.evaluate((betaEvent) => globalThis.chv1Playback.record({ ...betaEvent, type: "start", at: "2026-01-05T10:00:00.000Z" }), beta);
  const recentAfterEnable = await page.evaluate(() => globalThis.chv1Playback.recentSessions());
  assert.equal(recentAfterEnable.detailed.length, 1, "La réactivation doit recommencer un nouvel historique détaillé.");
  assert.equal(recentAfterEnable.detailed[0].videoId, "beta-video");
  assert.deepEqual(recentAfterEnable.recentVideoIds, ["beta-video", "alpha-video"]);
  assert.deepEqual(errors, [], `Erreurs renderer détectées après relance : ${errors.join(" | ")}`);
  console.log("Electron statistics/privacy E2E flow passed.");
} finally {
  await session.app.close();
  await rm(tempRoot, { recursive: true, force: true });
}
