"use strict";

import test from "node:test";
import assert from "node:assert/strict";

class FakeVideoElement {
  constructor() {
    this.currentTime = 10;
    this.duration = 120;
    this.ended = false;
    this.muted = false;
    this.paused = false;
    this.playbackRate = 1;
    this.style = { opacity: "1" };
    this.pauseCount = 0;
    this.playCount = 0;
  }
  pause() { this.paused = true; this.pauseCount += 1; }
  async play() { this.paused = false; this.playCount += 1; }
}

globalThis.HTMLVideoElement = FakeVideoElement;
globalThis.window = { setTimeout };

const [{ ActiveItemController }, { ItemController }] = await Promise.all([
  import("../src/game/active-item-controller.js"),
  import("../src/game/item-controller.js")
]);

function createHarness({ itemId, upgraded = false, wait } = {}) {
  const gameState = {
    status: "encounter",
    inventory: [itemId],
    upgradedItemIds: upgraded ? [itemId] : [],
    itemRunState: {},
    runFlags: new Map(),
    hasItem(id) { return this.inventory.includes(id); },
    isItemDisabled() { return false; },
    isItemUpgraded(id) { return this.upgradedItemIds.includes(id); },
    setRunFlag(key, value) { this.runFlags.set(key, value); },
    getRunFlag(key) { return this.runFlags.get(key); }
  };
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  const video = new FakeVideoElement();
  const statuses = [];
  const controller = new ActiveItemController({
    gameState,
    itemController,
    video,
    wait: wait ?? (async () => {}),
    onStatusChange(message) { statuses.push(message); }
  });
  return { gameState, itemController, video, statuses, controller };
}

test("Temps mort met la vidéo en pause pendant trente secondes puis reprend", async () => {
  const waits = [];
  const { controller, video, itemController } = createHarness({ itemId: "time-out", wait: async (ms) => waits.push(ms) });
  await controller.use("time-out");
  assert.equal(video.pauseCount, 1);
  assert.equal(video.playCount, 1);
  assert.equal(waits.length, 30);
  assert.equal(itemController.getState("time-out").remainingRechargeRounds, 1);
});

test("Temps mort amélioré dure quarante-cinq secondes", async () => {
  const waits = [];
  const { controller } = createHarness({ itemId: "time-out", upgraded: true, wait: async (ms) => waits.push(ms) });
  await controller.use("time-out");
  assert.equal(waits.length, 45);
});

test("Écran de fumée masque seulement l’image puis restaure son opacité", async () => {
  const observed = [];
  const { controller, video } = createHarness({
    itemId: "smoke-screen",
    wait: async () => observed.push({ opacity: video.style.opacity, muted: video.muted })
  });
  await controller.use("smoke-screen");
  assert.ok(observed.length > 0);
  assert.ok(observed.every((state) => state.opacity === "0" && state.muted === false));
  assert.equal(video.style.opacity, "1");
});

test("Écran de fumée amélioré reste actif huit secondes", async () => {
  const waits = [];
  const { controller } = createHarness({ itemId: "smoke-screen", upgraded: true, wait: async (ms) => waits.push(ms) });
  await controller.use("smoke-screen");
  assert.equal(waits.length, 8);
});

test("Silencieux coupe seulement le son puis restaure l’état initial", async () => {
  const observed = [];
  const { controller, video } = createHarness({
    itemId: "silencer",
    wait: async () => observed.push({ opacity: video.style.opacity, muted: video.muted })
  });
  await controller.use("silencer");
  assert.ok(observed.length > 0);
  assert.ok(observed.every((state) => state.muted === true && state.opacity === "1"));
  assert.equal(video.muted, false);
});

test("Silencieux amélioré reste actif quinze secondes", async () => {
  const waits = [];
  const { controller } = createHarness({ itemId: "silencer", upgraded: true, wait: async (ms) => waits.push(ms) });
  await controller.use("silencer");
  assert.equal(waits.length, 15);
});

test("Chronomètre fissuré met en pause quinze secondes et demande deux rencontres de recharge", async () => {
  const waits = [];
  const { controller, itemController } = createHarness({ itemId: "cracked-stopwatch", wait: async (ms) => waits.push(ms) });
  await controller.use("cracked-stopwatch");
  assert.equal(waits.length, 15);
  assert.equal(itemController.getState("cracked-stopwatch").remainingRechargeRounds, 2);
});

test("Chronomètre fissuré amélioré recharge après une seule rencontre", async () => {
  const { controller, itemController } = createHarness({ itemId: "cracked-stopwatch", upgraded: true });
  await controller.use("cracked-stopwatch");
  assert.equal(itemController.getState("cracked-stopwatch").remainingRechargeRounds, 1);
  itemController.advanceRechargeCounters({ encounterType: "normal" });
  assert.equal(itemController.getState("cracked-stopwatch").available, true);
});

test("Sablier avance la vidéo de quinze secondes sans dépasser sa durée", async () => {
  const { controller, video, itemController } = createHarness({ itemId: "hourglass" });
  await controller.use("hourglass");
  assert.equal(video.currentTime, 25);
  assert.equal(itemController.getState("hourglass").remainingRechargeRounds, 2);
});

test("Sablier amélioré avance la vidéo de vingt-cinq secondes", async () => {
  const { controller, video } = createHarness({ itemId: "hourglass", upgraded: true });
  await controller.use("hourglass");
  assert.equal(video.currentTime, 35);
});

test("Sablier est limité juste avant la fin de la vidéo", async () => {
  const { controller, video } = createHarness({ itemId: "hourglass" });
  video.currentTime = 115;
  await controller.use("hourglass");
  assert.equal(video.currentTime, 119.9);
});

test("annuler un effet temporaire restaure immédiatement la vidéo", async () => {
  let releaseWait;
  const pendingWait = new Promise((resolve) => { releaseWait = resolve; });
  const { controller, video } = createHarness({ itemId: "smoke-screen", wait: async () => pendingWait });
  const usePromise = controller.use("smoke-screen");
  await Promise.resolve();
  assert.equal(video.style.opacity, "0");
  assert.equal(controller.cancelActiveEffect(), true);
  assert.equal(video.style.opacity, "1");
  releaseWait();
  await usePromise;
  assert.equal(controller.isBusy(), false);
});
