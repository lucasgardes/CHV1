"use strict";

import assert from "node:assert/strict";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const root = await mkdir(path.join(os.tmpdir(), `chv1-library-persistence-${process.pid}`), { recursive: true }).then(() => path.join(os.tmpdir(), `chv1-library-persistence-${process.pid}`));
const userData = path.join(root, "user-data");
const library = path.join(userData, "media");
const videoFolder = path.join(library, "videos", "normal", "persistent-video");
const imageFolder = path.join(library, "images", "special", "persistent-image");
const unavailableFolder = path.join(library, "videos", "normal", "unavailable-video");
const sourceVideo = path.resolve("assets/test/test-video.mp4");
const sourceFunscript = path.resolve("assets/test/test-video.funscript");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXQAAAAASUVORK5CYII=", "base64");

async function writeFixture() {
  await mkdir(videoFolder, { recursive: true });
  await mkdir(imageFolder, { recursive: true });
  await mkdir(unavailableFolder, { recursive: true });
  await cp(sourceVideo, path.join(videoFolder, "video.mp4"));
  await cp(sourceFunscript, path.join(videoFolder, "normal.funscript"));
  await writeFile(path.join(videoFolder, "thumb.png"), png);
  await writeFile(path.join(imageFolder, "image.png"), png);
  await writeFile(path.join(unavailableFolder, "video.mp4"), Buffer.from("not-a-real-video"));
  await cp(sourceFunscript, path.join(unavailableFolder, "normal.funscript"));

  await writeFile(path.join(videoFolder, "metadata.json"), JSON.stringify({
    schemaVersion: 1,
    id: "persistent-video",
    title: "Vidéo persistante",
    type: "normal",
    durationSeconds: 4,
    themes: ["theme-alpha"],
    performers: ["performer-alpha"],
    enabled: true,
    weight: 1,
    videoFile: "video.mp4",
    thumbnailFile: "thumb.png",
    funscripts: { normal: "normal.funscript" }
  }, null, 2));

  await writeFile(path.join(imageFolder, "metadata.json"), JSON.stringify({
    schemaVersion: 1,
    id: "persistent-image",
    title: "Image persistante",
    type: "special",
    themes: ["theme-alpha"],
    performers: ["performer-alpha"],
    enabled: true,
    imageFile: "image.png"
  }, null, 2));

  await writeFile(path.join(unavailableFolder, "metadata.json"), JSON.stringify({
    schemaVersion: 1,
    id: "unavailable-video",
    title: "Vidéo bientôt absente",
    type: "normal",
    durationSeconds: 4,
    themes: ["theme-beta"],
    performers: ["performer-beta"],
    enabled: true,
    weight: 1,
    videoFile: "video.mp4",
    funscripts: { normal: "normal.funscript" }
  }, null, 2));
}

async function launch() {
  const app = await electron.launch({
    args: [path.resolve("."), `--user-data-dir=${userData}`],
    env: { ...process.env, CHV1_TEST_MODE: "1", ELECTRON_DISABLE_SECURITY_WARNINGS: "1" }
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => Boolean(globalThis.chv1Media && globalThis.chv1Collection));
  return { app, page, errors };
}

try {
  await writeFixture();

  let session = await launch();
  let catalog = await session.page.evaluate(() => globalThis.chv1Media.scanLibrary({ force: true }));
  assert.equal(catalog.videos.length, 2);
  assert.equal(catalog.images.length, 1);
  assert.equal(catalog.cacheUsed, false);

  await session.page.evaluate(async () => {
    await globalThis.chv1Collection.update({ kind: "video", id: "persistent-video", patch: {
      discovered: true,
      completed: true,
      completedDifficulties: ["normal"],
      favorite: true,
      discoveredAt: "2026-07-28T10:00:00.000Z",
      title: "Vidéo persistante",
      type: "normal",
      durationSeconds: 4,
      difficulties: ["normal"],
      themes: ["theme-alpha"],
      performers: ["performer-alpha"]
    }});
    await globalThis.chv1Collection.unlockImage({ id: "persistent-image", unlockSource: "Test E2E", snapshot: {
      title: "Image persistante", type: "special", themes: ["theme-alpha"], performers: ["performer-alpha"]
    }});
  });

  const firstCollection = await session.page.evaluate(() => globalThis.chv1Collection.get());
  assert.equal(firstCollection.videos["persistent-video"].favorite, true);
  assert.equal(firstCollection.images["persistent-image"].unlocked, true);
  assert.deepEqual(session.errors, []);
  await session.app.close();

  session = await launch();
  const persisted = await session.page.evaluate(() => globalThis.chv1Collection.get());
  assert.equal(persisted.videos["persistent-video"].completed, true, "La progression vidéo doit survivre au redémarrage.");
  assert.equal(persisted.videos["persistent-video"].favorite, true, "Le favori doit survivre au redémarrage.");
  assert.equal(persisted.images["persistent-image"].unlocked, true, "Le déblocage d'image doit survivre au redémarrage.");

  await session.page.locator("#collection-navigation-tab").click();
  await session.page.locator("#collection-screen").waitFor({ state: "visible" });
  await session.page.waitForFunction(() => document.querySelectorAll(".collection-card").length >= 3);
  const completedCard = session.page.locator(".collection-card", { hasText: "Vidéo persistante" });
  assert.match(await completedCard.innerText(), /Terminée/);
  assert.match(await completedCard.innerText(), /★/);
  await session.app.close();

  const metadataPath = path.join(videoFolder, "metadata.json");
  const changed = JSON.parse(await (await import("node:fs/promises")).readFile(metadataPath, "utf8"));
  changed.title = "Vidéo persistante renommée";
  changed.themes = ["theme-alpha", "theme-renamed"];
  await writeFile(metadataPath, JSON.stringify(changed, null, 2));
  await rm(path.join(unavailableFolder, "video.mp4"));

  session = await launch();
  catalog = await session.page.evaluate(() => globalThis.chv1Media.scanLibrary());
  const renamed = catalog.videos.find((entry) => entry.id === "persistent-video");
  const missing = catalog.videos.find((entry) => entry.id === "unavailable-video");
  assert.equal(renamed.title, "Vidéo persistante renommée", "Le cache doit être invalidé après modification des métadonnées.");
  assert.ok(renamed.themes.includes("theme-renamed"));
  assert.equal(missing.available, false, "Un média supprimé doit être signalé indisponible.");
  assert.ok(missing.errors.includes("missing-video"));

  await writeFile(path.join(imageFolder, "metadata.json"), "{ invalid json");
  const recovered = await session.page.evaluate(() => globalThis.chv1Media.scanLibrary({ force: true }));
  assert.ok(recovered.errors.length >= 1, "Une métadonnée corrompue doit produire un diagnostic sans faire planter le scan.");
  assert.deepEqual(session.errors, []);
  await session.app.close();

  console.log("Electron library persistence and recovery E2E test passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
