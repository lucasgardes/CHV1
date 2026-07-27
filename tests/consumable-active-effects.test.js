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

const [{ ActiveItemController }, { ItemController }, { registerRunController }] = await Promise.all([
  import("../src/game/active-item-controller.js"),
  import("../src/game/item-controller.js"),
  import("../src/game/runtime-access.js")
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

function installRunController(overrides = {}) {
  const calls = [];
  const runController = {
    async abortEncounterWithEmergencyButton(itemId) { calls.push(["abort", itemId]); },
    armDelayedProtection(itemId) { calls.push(["protect", itemId]); },
    shortenCurrentEncounter(itemId) { calls.push(["shorten", itemId]); },
    async skipNormalEncounter(itemId) { calls.push(["skip", itemId]); },
    async leaveCurrentRoom(itemId) { calls.push(["leave", itemId]); },
    ...overrides
  };
  registerRunController(runController);
  return calls;
}

test("Bouton d’urgence appelle l’abandon sécurisé et consomme sa charge", async () => {
  const calls = installRunController();
  const { controller, itemController } = createHarness({ itemId: "emergency-button" });
  await controller.use("emergency-button");
  assert.deepEqual(calls, [["abort", "emergency-button"]]);
  assert.equal(itemController.getState("emergency-button").available, false);
});

test("Protection différée arme la protection de la prochaine défaite", async () => {
  const calls = installRunController();
  const { controller } = createHarness({ itemId: "delayed-protection" });
  await controller.use("delayed-protection");
  assert.deepEqual(calls, [["protect", "delayed-protection"]]);
});

test("Raccourci réduit la rencontre courante via le contrôleur de partie", async () => {
  const calls = installRunController();
  const { controller } = createHarness({ itemId: "shortcut" });
  await controller.use("shortcut");
  assert.deepEqual(calls, [["shorten", "shortcut"]]);
});

test("Clé du raccourci ignore la rencontre normale via le contrôleur de partie", async () => {
  const calls = installRunController();
  const { controller } = createHarness({ itemId: "shortcut-key" });
  await controller.use("shortcut-key");
  assert.deepEqual(calls, [["skip", "shortcut-key"]]);
});

test("Ticket de sortie quitte la salle actuelle sans résoudre son effet", async () => {
  const calls = installRunController();
  const { controller } = createHarness({ itemId: "exit-ticket" });
  await controller.use("exit-ticket");
  assert.deepEqual(calls, [["leave", "exit-ticket"]]);
});

test("Fragmentation met en pause, attend la durée configurée puis reprend", async () => {
  installRunController();
  const waits = [];
  const { controller, video } = createHarness({ itemId: "fragmentation", wait: async (ms) => { waits.push(ms); } });
  await controller.use("fragmentation");
  assert.equal(video.pauseCount, 1);
  assert.equal(video.playCount, 1);
  assert.equal(waits.length, 20);
  assert.ok(waits.every((value) => value === 1000));
});

test("Fragmentation améliorée applique une pause de trente secondes", async () => {
  installRunController();
  const waits = [];
  const { controller } = createHarness({ itemId: "fragmentation", upgraded: true, wait: async (ms) => { waits.push(ms); } });
  await controller.use("fragmentation");
  assert.equal(waits.length, 30);
});

test("un consommable ne peut pas être utilisé deux fois", async () => {
  installRunController();
  const { controller } = createHarness({ itemId: "shortcut" });
  await controller.use("shortcut");
  await assert.rejects(() => controller.use("shortcut"), /ne peut pas être utilisé/);
});

test("une rencontre verrouillée bloque tous les consommables actifs", async () => {
  installRunController();
  const { controller, itemController } = createHarness({ itemId: "emergency-button" });
  itemController.setEncounterLock(true);
  assert.equal(controller.canUse("emergency-button"), false);
  await assert.rejects(() => controller.use("emergency-button"), /ne peut pas être utilisé/);
});

test("les objets actifs sont refusés hors rencontre", async () => {
  installRunController();
  const { controller, gameState } = createHarness({ itemId: "shortcut" });
  gameState.status = "map";
  assert.equal(controller.canUse("shortcut"), false);
});
