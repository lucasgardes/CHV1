"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";

function createStateWithInventory(itemIds) {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.inventory = [...itemIds];
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  return { gameState, itemController };
}

test("Dernier rempart reste épuisé jusqu'à une restauration explicite", () => {
  const { gameState } = createStateWithInventory(["last-stand"]);

  assert.equal(gameState.isDefeatProtectionConsumed("last-stand"), false);
  assert.equal(gameState.consumeDefeatProtection("last-stand"), true);
  assert.equal(gameState.isDefeatProtectionConsumed("last-stand"), true);
  assert.equal(gameState.consumeDefeatProtection("last-stand"), false);
  assert.equal(gameState.restoreDefeatProtection("last-stand"), true);
  assert.equal(gameState.isDefeatProtectionConsumed("last-stand"), false);
  assert.equal(gameState.restoreDefeatProtection("last-stand"), false);
});

test("la protection différée est consommée exactement une fois", () => {
  const { gameState } = createStateWithInventory(["delayed-protection"]);

  gameState.armNextEncounterProtection();
  assert.equal(gameState.consumeNextEncounterProtection(), true);
  assert.equal(gameState.consumeNextEncounterProtection(), false);
});

test("un objet rechargeable à un round redevient disponible après une rencontre", () => {
  const { itemController } = createStateWithInventory(["time-out"]);

  itemController.consumeCharge("time-out");
  itemController.finishActivation("time-out");
  assert.equal(itemController.isAvailable("time-out"), false);

  const result = itemController.advanceRechargeCounters({ encounterType: "normal" });

  assert.deepEqual(result.rechargedItemIds, ["time-out"]);
  assert.equal(itemController.isAvailable("time-out"), true);
});

test("Chronomètre fissuré attend deux rencontres avant de se recharger", () => {
  const { itemController } = createStateWithInventory(["cracked-stopwatch"]);

  itemController.consumeCharge("cracked-stopwatch");
  itemController.finishActivation("cracked-stopwatch");

  itemController.advanceRechargeCounters({ encounterType: "normal" });
  assert.equal(itemController.isAvailable("cracked-stopwatch"), false);
  assert.equal(itemController.getState("cracked-stopwatch").remainingRechargeRounds, 1);

  itemController.advanceRechargeCounters({ encounterType: "normal" });
  assert.equal(itemController.isAvailable("cracked-stopwatch"), true);
});

test("la version améliorée du Chronomètre fissuré recharge après un seul round", () => {
  const { gameState, itemController } = createStateWithInventory(["cracked-stopwatch"]);
  gameState.upgradeItem("cracked-stopwatch");

  itemController.consumeCharge("cracked-stopwatch");
  itemController.finishActivation("cracked-stopwatch");
  itemController.advanceRechargeCounters({ encounterType: "normal" });

  assert.equal(itemController.isAvailable("cracked-stopwatch"), true);
});

test("Jeton de fuite se recharge après une élite", () => {
  const { itemController } = createStateWithInventory(["escape-token"]);

  itemController.consumeCharge("escape-token");
  itemController.finishActivation("escape-token");
  itemController.advanceRechargeCounters({ encounterType: "normal" });
  assert.equal(itemController.isAvailable("escape-token"), false);

  const result = itemController.advanceRechargeCounters({ encounterType: "elite" });

  assert.deepEqual(result.rechargedItemIds, ["escape-token"]);
  assert.equal(itemController.isAvailable("escape-token"), true);
});

test("rechargeAll restaure tous les rechargeables sans restaurer Dernier rempart", () => {
  const { gameState, itemController } = createStateWithInventory([
    "time-out",
    "cracked-stopwatch",
    "emergency-button",
    "last-stand"
  ]);

  itemController.consumeCharge("time-out");
  itemController.finishActivation("time-out");
  itemController.consumeCharge("cracked-stopwatch");
  itemController.finishActivation("cracked-stopwatch");
  itemController.consumeCharge("emergency-button");
  itemController.finishActivation("emergency-button");
  gameState.consumeDefeatProtection("last-stand");

  itemController.rechargeAll();

  assert.equal(itemController.isAvailable("time-out"), true);
  assert.equal(itemController.isAvailable("cracked-stopwatch"), true);
  assert.equal(gameState.hasItem("emergency-button"), true);
  assert.equal(itemController.isAvailable("emergency-button"), false);
  assert.equal(gameState.isDefeatProtectionConsumed("last-stand"), true);
});