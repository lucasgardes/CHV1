"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";
import { EncounterController } from "../src/game/encounter-controller.js";

class FakeVideoElement {
  pause() {}
  load() {}
  async play() {}
}

globalThis.HTMLVideoElement ??= FakeVideoElement;

function createHarness({ type = "normal", rewardGold = 40, inventory = [] } = {}) {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.inventory = [...inventory];
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.setCurrentEncounter({ encounterId: `${type}-test`, nodeId: "node-test", type });

  const itemController = new ItemController({ gameState });
  itemController.resetForRun();

  const callbacks = { normal: 0, elite: 0, boss: 0 };
  const encounter = {
    id: `${type}-test`,
    title: `Rencontre ${type}`,
    type,
    rewardGold,
    effectiveRewardGold: rewardGold,
    doubleBetAccepted: false
  };

  const controller = new EncounterController({
    gameState,
    itemController,
    video: new FakeVideoElement(),
    getEncounterById: () => encounter,
    stopVideoSync: async () => {},
    setFunscriptPath: () => {},
    loadFunscript: async () => {},
    resetActions: () => {},
    onNormalCompleted: () => { callbacks.normal += 1; },
    onEliteCompleted: () => { callbacks.elite += 1; },
    onBossCompleted: () => { callbacks.boss += 1; }
  });
  controller.currentEncounter = encounter;

  return { gameState, itemController, controller, callbacks, encounter };
}

test("une rencontre normale crédite l'or et revient à la carte", async () => {
  const { gameState, controller, callbacks } = createHarness({ type: "normal", rewardGold: 40 });
  const initialGold = gameState.gold;

  const result = await controller.complete();

  assert.equal(result.type, "normal");
  assert.equal(gameState.gold, initialGold + 40);
  assert.equal(gameState.status, GAME_STATUS.MAP);
  assert.equal(gameState.currentEncounter, null);
  assert.equal(callbacks.normal, 1);
});

test("une élite ouvre l'écran de récompense sans créditer immédiatement l'or", async () => {
  const { gameState, controller, callbacks } = createHarness({ type: "elite", rewardGold: 65 });
  const initialGold = gameState.gold;

  const result = await controller.complete();

  assert.equal(result.type, "elite");
  assert.equal(gameState.gold, initialGold);
  assert.equal(gameState.status, GAME_STATUS.REWARD);
  assert.equal(callbacks.elite, 1);
  const pending = gameState.getRunFlag("pending-elite-reward-context");
  assert.equal(pending.rewardGold, 65);
  assert.equal(pending.encounter.type, "elite");
});

test("un boss termine la partie en victoire", async () => {
  const { gameState, controller, callbacks } = createHarness({ type: "boss", rewardGold: 0 });

  const result = await controller.complete();

  assert.equal(result.type, "boss");
  assert.equal(gameState.status, GAME_STATUS.VICTORY);
  assert.equal(gameState.currentEncounter, null);
  assert.equal(callbacks.boss, 1);
});

test("Métronome et Clé du dernier acte terminent plusieurs rencontres sans blocage", async () => {
  const { gameState, controller } = createHarness({
    type: "normal",
    rewardGold: 40,
    inventory: ["metronome", "last-act-key"]
  });

  const first = await controller.complete();
  assert.equal(first.type, "normal");
  assert.ok(first.rewardGold >= 40);

  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.setCurrentEncounter({ encounterId: "normal-test", nodeId: "node-test-2", type: "normal" });
  controller.currentEncounter = { ...controller.getCurrentEncounter(), id: "normal-test", type: "normal", rewardGold: 40, effectiveRewardGold: 40 };

  const second = await controller.complete();
  assert.equal(second.type, "normal");
  assert.ok(second.rewardGold >= first.rewardGold);
  assert.equal(gameState.status, GAME_STATUS.MAP);
});

test("Éclaireur peut coexister avec Métronome et Clé du dernier acte à la fin d'une rencontre", async () => {
  const { gameState, controller } = createHarness({
    type: "normal",
    rewardGold: 40,
    inventory: ["scout", "metronome", "last-act-key"]
  });

  const result = await controller.complete();

  assert.equal(result.type, "normal");
  assert.equal(gameState.status, GAME_STATUS.MAP);
  assert.equal(gameState.currentEncounter, null);
});
