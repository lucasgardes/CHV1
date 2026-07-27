"use strict";

import test from "node:test";
import assert from "node:assert/strict";

class FakeVideoElement {
  constructor() {
    this.currentTime = 10;
    this.duration = 120;
    this.ended = false;
    this.muted = false;
    this.playbackRate = 1;
    this.style = { opacity: "1" };
  }
  pause() {}
  async play() {}
  load() {}
}

globalThis.HTMLVideoElement = FakeVideoElement;
globalThis.window = { setTimeout };

const [
  { EncounterController },
  { ActiveItemController },
  { ItemController },
  { VIDEOS }
] = await Promise.all([
  import("../src/game/encounter-controller.js"),
  import("../src/game/active-item-controller.js"),
  import("../src/game/item-controller.js"),
  import("../src/data/videos.js")
]);

function createGameState(inventory = [], upgradedItemIds = []) {
  return {
    status: "encounter",
    inventory: [...inventory],
    upgradedItemIds: [...upgradedItemIds],
    itemRunState: { rescueUsedInEncounter: false, metronomeStreak: 0 },
    runFlags: new Map(),
    hasItem(id) { return this.inventory.includes(id); },
    isItemDisabled() { return false; },
    isItemUpgraded(id) { return this.upgradedItemIds.includes(id); },
    setRunFlag(key, value) { this.runFlags.set(key, value); },
    getRunFlag(key) { return this.runFlags.get(key); },
    consumeEncounterModifiers() { return []; },
    queueNextFunscriptDifficultyShift(value) { this.queuedDifficultyShift = value; }
  };
}

function createEncounterHarness({ inventory = [], upgraded = [], chooseDirectorVideo = null, chooseDoubleBet = null } = {}) {
  const gameState = createGameState(inventory, upgraded);
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  const video = new FakeVideoElement();
  const controller = new EncounterController({
    gameState,
    itemController,
    video,
    getEncounterById(id) { return VIDEOS.find((entry) => entry.id === id) ?? null; },
    stopVideoSync: async () => {},
    setFunscriptPath() {},
    loadFunscript: async () => {},
    resetActions() {},
    resolveFunscript({ encounter }) {
      return {
        difficulty: encounter.difficulty ?? "normal",
        requestedDifficulty: encounter.difficulty ?? "normal",
        path: encounter.funscriptPath ?? "test.funscript",
        fallbackUsed: false
      };
    },
    chooseDirectorVideo,
    chooseDoubleBet
  });
  return { gameState, itemController, video, controller };
}

test("Œil du réalisateur conserve la vidéo courante lorsque le joueur la choisit", async () => {
  const current = VIDEOS.find((entry) => VIDEOS.some((other) => other.type === entry.type && other.id !== entry.id));
  assert.ok(current, "Le catalogue doit contenir deux vidéos du même type pour ce test.");
  const { controller } = createEncounterHarness({
    inventory: ["director-eye"],
    chooseDirectorVideo: async ({ current: proposed }) => proposed.id
  });
  const selected = await controller.resolveDirectorChoice(current);
  assert.equal(selected.id, current.id);
});

test("Œil du réalisateur peut sélectionner la vidéo alternative", async () => {
  const current = VIDEOS.find((entry) => VIDEOS.some((other) => other.type === entry.type && other.id !== entry.id));
  assert.ok(current);
  let alternateId = null;
  const { controller } = createEncounterHarness({
    inventory: ["director-eye"],
    chooseDirectorVideo: async ({ alternate }) => {
      alternateId = alternate.id;
      return alternate.id;
    }
  });
  const selected = await controller.resolveDirectorChoice(current);
  assert.equal(selected.id, alternateId);
  assert.notEqual(selected.id, current.id);
});

test("Double mise refusée ne modifie ni récompense ni difficulté", async () => {
  const { controller } = createEncounterHarness({
    inventory: ["double-bet"],
    chooseDoubleBet: async () => false
  });
  assert.deepEqual(await controller.resolveDoubleBet(), {
    accepted: false,
    rewardMultiplier: 1,
    difficultyShift: 0
  });
});

test("Double mise acceptée double la récompense et augmente la difficulté", async () => {
  const { controller } = createEncounterHarness({
    inventory: ["double-bet"],
    chooseDoubleBet: async () => true
  });
  assert.deepEqual(await controller.resolveDoubleBet(), {
    accepted: true,
    rewardMultiplier: 2,
    difficultyShift: 1
  });
});

test("Métronome augmente progressivement le multiplicateur jusqu'à son plafond", () => {
  const { controller } = createEncounterHarness({ inventory: ["metronome"] });
  const multipliers = Array.from({ length: 7 }, () => controller.getMetronomeMultiplier());
  assert.deepEqual(multipliers, [1.05, 1.1, 1.15, 1.2, 1.25, 1.25, 1.25]);
});

test("Métronome amélioré augmente plus vite et respecte son nouveau plafond", () => {
  const { controller } = createEncounterHarness({ inventory: ["metronome"], upgraded: ["metronome"] });
  const multipliers = Array.from({ length: 6 }, () => controller.getMetronomeMultiplier());
  assert.deepEqual(multipliers, [1.08, 1.16, 1.24, 1.32, 1.35, 1.35]);
});

test("un objet de secours remet la série du Métronome à zéro", () => {
  const { controller, gameState } = createEncounterHarness({ inventory: ["metronome"] });
  controller.getMetronomeMultiplier();
  controller.getMetronomeMultiplier();
  gameState.itemRunState.rescueUsedInEncounter = true;
  assert.equal(controller.getMetronomeMultiplier(), 1);
  assert.equal(gameState.itemRunState.metronomeStreak, 0);
});

test("Ceinture utilitaire ajoute un emplacement actif, puis deux lorsqu'elle est améliorée", () => {
  for (const [upgraded, expected] of [[false, 4], [true, 5]]) {
    const gameState = createGameState(["utility-belt"], upgraded ? ["utility-belt"] : []);
    const itemController = new ItemController({ gameState });
    itemController.resetForRun();
    const controller = new ActiveItemController({ gameState, itemController, video: new FakeVideoElement() });
    assert.equal(controller.getActiveCapacity(), expected);
  }
});

test("Recycleur ne peut préserver qu'un consommable par période", () => {
  const gameState = createGameState(["recycler"]);
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  assert.equal(itemController.shouldPreserveConsumable(() => 0), true);
  assert.equal(itemController.shouldPreserveConsumable(() => 0), false);
  itemController.advanceRechargeCounters({ encounterType: "elite" });
  assert.equal(itemController.shouldPreserveConsumable(() => 0), true);
});

test("Recycleur respecte ses probabilités normale et améliorée", () => {
  const normalState = createGameState(["recycler"]);
  const normalController = new ItemController({ gameState: normalState });
  normalController.resetForRun();
  assert.equal(normalController.shouldPreserveConsumable(() => 0.3), false);

  const upgradedState = createGameState(["recycler"], ["recycler"]);
  const upgradedController = new ItemController({ gameState: upgradedState });
  upgradedController.resetForRun();
  assert.equal(upgradedController.shouldPreserveConsumable(() => 0.3), true);
});

test("Batterie externe réduit d'un round la recharge des objets rechargeables", () => {
  const gameState = createGameState(["external-battery", "cracked-stopwatch"]);
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  itemController.consumeCharge("cracked-stopwatch");
  itemController.finishActivation("cracked-stopwatch");
  const result = itemController.advanceRechargeCounters({ encounterType: "normal" });
  assert.deepEqual(result.rechargedItemIds, ["cracked-stopwatch"]);
  assert.equal(itemController.getState("cracked-stopwatch").available, true);
});

test("Double commande prépare une seconde utilisation gratuite du même objet", () => {
  const gameState = createGameState(["double-command", "time-out"]);
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  const controller = new ActiveItemController({ gameState, itemController, video: new FakeVideoElement() });
  controller.armDoubleCommand("time-out");
  assert.equal(controller.shouldUseFreeDoubleCommand("time-out"), true);
  assert.equal(controller.shouldUseFreeDoubleCommand("smoke-screen"), false);
});
