"use strict";

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const root = process.cwd();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "chv1-collection-e2e-"));
const userData = path.join(tempRoot, "user-data");
const mediaRoot = path.join(userData, "media");
const sourceVideo = path.join(root, "assets", "test", "test-video.mp4");
const sourceFunscript = path.join(root, "assets", "test", "test-video.funscript");
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createVideo({ id, title, type, performers, themes, difficulties }) {
  const folder = path.join(mediaRoot, "videos", type, id);
  await mkdir(folder, { recursive: true });
  await cp(sourceVideo, path.join(folder, "video.mp4"));
  await writeFile(path.join(folder, "thumb.png"), tinyPng);
  const funscripts = {};
  for (const difficulty of difficulties) {
    const filename = `${difficulty}.funscript`;
    await cp(sourceFunscript, path.join(folder, filename));
    funscripts[difficulty] = filename;
  }
  await writeJson(path.join(folder, "metadata.json"), {
    schemaVersion: 1,
    id,
    title,
    type,
    durationSeconds: 4,
    themes,
    performers,
    enabled: true,
    weight: 1,
    allowRepeatInSameRun: false,
    videoFile: "video.mp4",
    thumbnailFile: "thumb.png",
    funscripts
  });
}

async function createImage({ id, title, type, performers, themes }) {
  const folder = path.join(mediaRoot, "images", type, id);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "image.png"), tinyPng);
  await writeJson(path.join(folder, "metadata.json"), {
    schemaVersion: 1,
    id,
    title,
    type,
    themes,
    performers,
    enabled: true,
    imageFile: "image.png"
  });
}

await mkdir(userData, { recursive: true });
await Promise.all([
  createVideo({ id: "alpha-video", title: "Alpha Session", type: "normal", performers: ["alice"], themes: ["tease"], difficulties: ["easy", "normal"] }),
  createVideo({ id: "beta-video", title: "Beta Boss", type: "boss", performers: ["betty"], themes: ["boss"], difficulties: ["hard"] }),
  createVideo({ id: "gamma-video", title: "Gamma Elite", type: "elite", performers: ["alice"], themes: ["boss"], difficulties: ["normal"] }),
  createImage({ id: "alpha-image", title: "Alpha Portrait", type: "performer", performers: ["alice"], themes: ["tease"] }),
  createImage({ id: "beta-image", title: "Beta Trophy", type: "event", performers: ["betty"], themes: ["boss"] }),
  createImage({ id: "gamma-image", title: "Gamma Secret", type: "secret", performers: ["alice"], themes: ["boss"] })
]);

await writeJson(path.join(userData, "collection.json"), {
  schemaVersion: 1,
  videos: {
    "alpha-video": { discovered: true, completed: false, bestProgressPercent: 42, discoveredAt: "2026-01-01T10:00:00.000Z", completedDifficulties: [], favorite: false },
    "beta-video": { discovered: true, completed: true, bestProgressPercent: 100, discoveredAt: "2026-02-01T10:00:00.000Z", completedDifficulties: ["hard"], favorite: false },
    "ghost-video": { discovered: true, completed: false, title: "Vidéo déplacée", type: "normal", durationSeconds: 12, difficulties: ["normal"], themes: ["tease"], performers: ["alice"], discoveredAt: "2025-12-01T10:00:00.000Z", favorite: false }
  },
  images: {
    "alpha-image": { unlocked: true, unlockedAt: "2026-01-05T10:00:00.000Z", unlockSource: "Événement Alpha", favorite: false },
    "beta-image": { unlocked: true, unlockedAt: "2026-02-05T10:00:00.000Z", unlockSource: "Boss Beta", favorite: false }
  }
});

const app = await electron.launch({
  args: [path.resolve("."), `--user-data-dir=${userData}`],
  env: { ...process.env, CHV1_TEST_MODE: "1", ELECTRON_DISABLE_SECURITY_WARNINGS: "1" }
});
const page = await app.firstWindow();
const rendererErrors = [];
page.on("pageerror", (error) => rendererErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") rendererErrors.push(message.text()); });

const cards = () => page.locator("#collection-grid .collection-card");
const visibleTitles = async () => cards().locator(".collection-card-heading strong").allTextContents();
async function resetFilters() {
  await page.locator("#collection-search").fill("");
  await page.locator("#collection-performer-filter").selectOption([]);
  await page.locator("#collection-theme-filter").selectOption([]);
  await page.locator("#collection-state-filter").selectOption("all");
  await page.locator("#collection-type-filter").selectOption("");
  await page.locator("#collection-difficulty-filter").selectOption("");
  await page.locator("#collection-favorites-only").uncheck();
  await page.locator("#collection-sort").selectOption("title");
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#collection-navigation-tab").click();
  await page.locator("#collection-screen").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelectorAll("#collection-grid .collection-card").length >= 4);

  let titles = await visibleTitles();
  assert.ok(titles.includes("Alpha Session"));
  assert.ok(titles.includes("Beta Boss"));
  assert.ok(titles.includes("Vidéo déplacée"));
  assert.ok(titles.includes("???"), "Une vidéo non découverte doit rester masquée.");
  const ghost = cards().filter({ hasText: "Vidéo déplacée" });
  assert.equal(await ghost.isDisabled(), true);
  assert.match(await ghost.textContent(), /indisponible/i);

  await page.locator("#collection-state-filter").selectOption("unfinished");
  titles = await visibleTitles();
  assert.deepEqual(new Set(titles), new Set(["Alpha Session", "Vidéo déplacée"]));
  await page.locator("#collection-state-filter").selectOption("completed");
  assert.deepEqual(await visibleTitles(), ["Beta Boss"]);

  await resetFilters();
  await page.locator("#collection-search").fill("alice");
  titles = await visibleTitles();
  assert.ok(titles.includes("Alpha Session"));
  assert.ok(!titles.includes("???"), "La recherche ne doit pas révéler un média verrouillé.");

  await resetFilters();
  await page.locator("#collection-performer-filter").selectOption(["alice"]);
  await page.locator("#collection-theme-filter").selectOption(["tease"]);
  titles = await visibleTitles();
  assert.ok(titles.includes("Alpha Session"));
  assert.ok(titles.includes("Vidéo déplacée"));
  assert.ok(!titles.includes("Beta Boss"));

  await resetFilters();
  await page.locator("#collection-type-filter").selectOption("boss");
  assert.deepEqual(await visibleTitles(), ["Beta Boss"]);
  await resetFilters();
  await page.locator("#collection-difficulty-filter").selectOption("hard");
  assert.deepEqual(await visibleTitles(), ["Beta Boss"]);

  await resetFilters();
  await page.locator("#collection-sort").selectOption("recent");
  titles = await visibleTitles();
  assert.equal(titles[0], "Beta Boss", "Le tri récent doit afficher le média le plus récemment découvert en premier.");

  await resetFilters();
  const alphaCard = cards().filter({ hasText: "Alpha Session" });
  await alphaCard.locator(".collection-favorite").click();
  await page.locator("#collection-favorites-only").check();
  assert.deepEqual(await visibleTitles(), ["Alpha Session"]);
  const persistedFavorite = await page.evaluate(async () => (await globalThis.chv1Collection.get()).videos["alpha-video"].favorite);
  assert.equal(persistedFavorite, true);

  await page.locator("#collection-favorites-only").uncheck();
  const statsBefore = await page.evaluate(() => globalThis.chv1VideoStats.get());
  await cards().filter({ hasText: "Alpha Session" }).click();
  await page.locator("#collection-viewer").waitFor({ state: "visible" });
  assert.equal(await page.locator("#collection-viewer-title").textContent(), "Alpha Session");
  assert.equal(await page.locator("#collection-video-controls").isVisible(), true);
  assert.equal(await page.locator("#collection-difficulty").locator("option").count(), 2);
  await page.locator("#collection-difficulty").selectOption("normal");
  await page.locator("#collection-speed").selectOption("1.5");
  await page.locator("#collection-volume").fill("0.4");
  await page.locator("#collection-play-pause").click();
  await page.waitForTimeout(500);
  await page.locator("#collection-forward").click();
  await page.locator("#collection-backward").click();
  const videoSettings = await page.locator("#collection-video").evaluate((video) => ({ rate: video.playbackRate, volume: video.volume }));
  assert.equal(videoSettings.rate, 1.5);
  assert.equal(videoSettings.volume, 0.4);
  await page.locator("#collection-close-viewer").click();
  const statsAfter = await page.evaluate(() => globalThis.chv1VideoStats.get());
  assert.deepEqual(statsAfter, statsBefore, "La lecture libre ne doit pas modifier les statistiques de partie.");

  await page.locator('[data-collection-kind="image"]').click();
  await page.waitForFunction(() => document.querySelectorAll("#collection-grid .collection-card").length >= 3);
  titles = await visibleTitles();
  assert.ok(titles.includes("Alpha Portrait"));
  assert.ok(titles.includes("Beta Trophy"));
  assert.ok(titles.includes("???"));
  assert.equal(await page.locator("#collection-difficulty-filter").isHidden(), true);

  await cards().filter({ hasText: "Alpha Portrait" }).click();
  await page.locator("#collection-image-controls").waitFor({ state: "visible" });
  await page.locator("#collection-image-zoom-in").click();
  assert.equal(await page.locator("#collection-image-zoom").textContent(), "125 %");
  await page.locator("#collection-image-next").click();
  assert.equal(await page.locator("#collection-viewer-title").textContent(), "Beta Trophy");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator("#collection-viewer-title").textContent(), "Alpha Portrait");
  await page.locator("#collection-image-reset").click();
  assert.equal(await page.locator("#collection-image-zoom").textContent(), "100 %");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#collection-viewer").isHidden(), true);

  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron collection/library E2E flow passed.");
} finally {
  await app.close();
  await rm(tempRoot, { recursive: true, force: true });
}
