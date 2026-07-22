import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";

function createStateWith(...itemIds) {
  const gameState = new GameState();
  gameState.startRun();
  for (const itemId of itemIds) gameState.addItem(itemId);
  return gameState;
}

test("un objet rechargeable devient indisponible puis se recharge", () => {
  const gameState = createStateWith("time-out");
  const controller = new ItemController({ gameState });

  controller.activate("time-out");
  controller.consumeCharge("time-out");
  controller.finishActivation("time-out");

  assert.equal(controller.isAvailable("time-out"), false);
  assert.equal(controller.getState("time-out").remainingRechargeRounds, 1);

  controller.advanceRechargeCounters({ encounterType: "normal" });
  assert.equal(controller.isAvailable("time-out"), true);
});

test("le chronomètre fissuré demande deux rencontres puis une après amélioration", () => {
  const gameState = createStateWith("cracked-stopwatch");
  const controller = new ItemController({ gameState });

  controller.activate("cracked-stopwatch");
  controller.consumeCharge("cracked-stopwatch");
  controller.finishActivation("cracked-stopwatch");
  assert.equal(controller.getState("cracked-stopwatch").remainingRechargeRounds, 2);

  controller.advanceRechargeCounters();
  assert.equal(controller.isAvailable("cracked-stopwatch"), false);
  controller.advanceRechargeCounters();
  assert.equal(controller.isAvailable("cracked-stopwatch"), true);

  gameState.upgradeItem("cracked-stopwatch");
  controller.activate("cracked-stopwatch");
  controller.consumeCharge("cracked-stopwatch");
  controller.finishActivation("cracked-stopwatch");
  assert.equal(controller.getState("cracked-stopwatch").remainingRechargeRounds, 1);
});

test("le repos recharge tous les rechargeables", () => {
  const gameState = createStateWith("time-out", "silencer");
  const controller = new ItemController({ gameState });

  for (const itemId of gameState.inventory) {
    controller.activate(itemId);
    controller.consumeCharge(itemId);
    controller.finishActivation(itemId);
  }

  controller.rechargeAll();
  assert.equal(controller.isAvailable("time-out"), true);
  assert.equal(controller.isAvailable("silencer"), true);
});

test("un nouvel objet est disponible immédiatement", () => {
  const gameState = createStateWith();
  const controller = new ItemController({ gameState });
  gameState.addItem("smoke-screen");
  assert.equal(controller.isAvailable("smoke-screen"), true);
});
