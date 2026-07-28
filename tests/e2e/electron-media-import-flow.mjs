"use strict";

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { _electron as electron } from "playwright-core";

const root = process.cwd();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "chv1-import-e2e-"));
const userData = path.join(tempRoot, "user-data");
const sourceRoot = path.join(tempRoot, "sources");
const sourceVideo = path.join(sourceRoot, "Imported Session.mp4");
const sourceFunscript = path.join(sourceRoot, "Imported Session normal.funscript");
const sourceImage = path.join(sourceRoot, "Imported Trophy.png");
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");

await mkdir(sourceRoot, { recursive: true });
await mkdir(userData, { recursive: true });
await cp(path.join(root, "assets", "test", "test-video.mp4"), sourceVideo);
await cp(path.join(root, "assets", "test", "test-video.funscript"), sourceFunscript);
await writeFile(sourceImage, tinyPng);

const app = await electron.launch({
  args: [path.resolve("."), `--user-data-dir=${userData}`],
  env: { ...process.env, CHV1_TEST_MODE: "1", ELECTRON_DISABLE_SECURITY_WARNINGS: "1" }
});

const page = await app.firstWindow();
const rendererErrors = [];
page.on("pageerror", (error) => rendererErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") rendererErrors.push(message.text()); });

async function installDialogResult(filePaths) {
  await app.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
  }, filePaths);
}

async function answerPrompts(answers) {
  let index = 0;
  const handler = async (dialog) => {
    assert.equal(dialog.type(), "prompt");
    assert.ok(index < answers.length, `Prompt inattendu : ${dialog.message()}`);
    await dialog.accept(answers[index++]);
  };
  page.on("dialog", handler);
  return () => {
    page.off("dialog", handler);
    assert.equal(index, answers.length, `Tous les prompts attendus doivent être affichés (${index}/${answers.length}).`);
  };
}

try {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#collection-navigation-tab").click();
  await page.locator("#collection-screen").waitFor({ state: "visible" });
  await page.locator("#media-import-actions").waitFor({ state: "visible" });

  await installDialogResult([sourceVideo, sourceFunscript]);
  let finishPrompts = await answerPrompts([
    "Imported Session",
    "imported-session",
    "normal",
    "Alice, Betty",
    "tease, challenge",
    "normal"
  ]);
  await page.getByRole("button", { name: "Importer une vidéo" }).click();
  await page.waitForFunction(() => document.getElementById("media-import-status")?.textContent?.includes("Vidéo importée"), null, { timeout: 15_000 });
  finishPrompts();

  await page.waitForLoadState("domcontentloaded");
  await page.locator("#collection-navigation-tab").click();
  const videoCatalog = await page.evaluate(() => globalThis.chv1Media.scanLibrary());
  const importedVideo = videoCatalog.videos.find((entry) => entry.id === "imported-session");
  assert.ok(importedVideo, "La vidéo importée doit apparaître dans le catalogue.");
  assert.equal(importedVideo.title, "Imported Session");
  assert.equal(importedVideo.type, "normal");
  assert.deepEqual(new Set(importedVideo.performers), new Set(["alice", "betty"]));
  assert.deepEqual(new Set(importedVideo.themes), new Set(["tease", "challenge"]));
  assert.ok(importedVideo.durationSeconds > 0, "La durée doit être détectée lors de la finalisation.");
  assert.ok(importedVideo.thumbnailPath, "Une miniature doit être créée lors de l’import.");
  assert.ok(importedVideo.funscripts.normal, "Le funscript normal doit être associé.");

  await page.evaluate(async () => {
    await globalThis.chv1Collection.update({ kind: "video", id: "imported-session", patch: { discovered: true } });
    window.dispatchEvent(new CustomEvent("chv1:collection-updated"));
  });
  await page.waitForFunction(() => [...document.querySelectorAll("#collection-grid .collection-card")].some((card) => card.textContent.includes("Imported Session")));

  await installDialogResult([sourceImage]);
  finishPrompts = await answerPrompts([
    "Imported Trophy",
    "imported-trophy",
    "special",
    "Alice",
    "reward, tease"
  ]);
  await page.getByRole("button", { name: "Importer une image" }).click();
  await page.waitForFunction(() => document.getElementById("media-import-status")?.textContent?.includes("Image importée"), null, { timeout: 10_000 });
  finishPrompts();

  await page.waitForLoadState("domcontentloaded");
  await page.locator("#collection-navigation-tab").click();
  const imageCatalog = await page.evaluate(() => globalThis.chv1Media.scanLibrary());
  const importedImage = imageCatalog.images.find((entry) => entry.id === "imported-trophy");
  assert.ok(importedImage, "L’image importée doit apparaître dans le catalogue.");
  assert.equal(importedImage.title, "Imported Trophy");
  assert.equal(importedImage.type, "special");
  assert.deepEqual(importedImage.performers, ["alice"]);
  assert.deepEqual(new Set(importedImage.themes), new Set(["reward", "tease"]));

  await page.evaluate(async () => {
    await globalThis.chv1Collection.unlockImage({ id: "imported-trophy", source: "Test d’import" });
    window.dispatchEvent(new CustomEvent("chv1:collection-updated"));
  });
  await page.locator('[data-collection-kind="image"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll("#collection-grid .collection-card")].some((card) => card.textContent.includes("Imported Trophy")));
  const imageCard = page.locator("#collection-grid .collection-card").filter({ hasText: "Imported Trophy" });
  await imageCard.click();
  await page.locator("#collection-image-controls").waitFor({ state: "visible" });
  assert.equal(await page.locator("#collection-viewer-title").textContent(), "Imported Trophy");
  await page.keyboard.press("Escape");

  // Annulation du sélecteur : aucun prompt et aucun média supplémentaire.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  const countBeforeCancel = (await page.evaluate(() => globalThis.chv1Media.scanLibrary())).videos.length;
  await page.getByRole("button", { name: "Importer une vidéo" }).click();
  await page.waitForFunction(() => document.getElementById("media-import-status")?.textContent === "Import annulé.");
  const countAfterCancel = (await page.evaluate(() => globalThis.chv1Media.scanLibrary())).videos.length;
  assert.equal(countAfterCancel, countBeforeCancel, "Un import annulé ne doit créer aucun média.");

  // Identifiant déjà utilisé : l’erreur doit être affichée sans casser l’interface.
  await installDialogResult([sourceVideo, sourceFunscript]);
  finishPrompts = await answerPrompts([
    "Duplicate Session",
    "imported-session",
    "normal",
    "Alice",
    "tease",
    "normal"
  ]);
  await page.getByRole("button", { name: "Importer une vidéo" }).click();
  await page.waitForFunction(() => document.getElementById("media-import-status")?.classList.contains("is-error"), null, { timeout: 10_000 });
  finishPrompts();
  assert.ok((await page.locator("#media-import-status").textContent()).trim().length > 0);
  assert.equal((await page.evaluate(() => globalThis.chv1Media.scanLibrary())).videos.filter((entry) => entry.id === "imported-session").length, 1);

  assert.deepEqual(rendererErrors, [], `Erreurs renderer détectées : ${rendererErrors.join(" | ")}`);
  console.log("Electron media import E2E flow passed.");
} finally {
  await app.close();
  await rm(tempRoot, { recursive: true, force: true });
}
