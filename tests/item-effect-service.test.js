"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";
import { ItemEffectService } from "../src/game/item-effect-service.js";

function setup(items = [], upgraded = []) {
  const gameState = new GameState();
  gameState.inventory = [...items];
  gameState.upgradedItemIds = [...upgraded];
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  return { gameState, itemController };
}

test("les réductions de durée passives se cumulent", () => {
  const { gameState, itemController } = setup(["broken-watch", "golden-hourglass"], ["broken-watch"]);
  const service = new ItemEffectService({ gameState, itemController, random:() => 1 });
  const result = service.getEncounterModifiers({ type:"normal" });
  assert.equal(result.durationReductionSeconds, 60);
});

test("Pari du clown double la récompense et allonge un élite", () => {
  const { gameState, itemController } = setup(["clown-bet"]);
  const service = new ItemEffectService({ gameState, itemController, random:() => 1 });
  const result = service.getEncounterModifiers({ type:"elite" });
  assert.equal(result.rewardMultiplier, 2);
  assert.equal(result.durationExtraSeconds, 30);
});

test("Batterie possédée améliorée accorde le bonus prévu", () => {
  const { gameState, itemController } = setup(["possessed-battery"], ["possessed-battery"]);
  const service = new ItemEffectService({ gameState, itemController, random:() => 0 });
  const result = service.getEncounterModifiers({ type:"normal" });
  assert.equal(result.possessedBatteryTriggered, true);
  assert.equal(result.possessedBatteryGoldBonus, 8);
  assert.equal(result.intensityMultiplier, 1.3);
});

test("Porte-monnaie percé applique son coût de déplacement", () => {
  const { gameState, itemController } = setup(["leaky-wallet"], ["leaky-wallet"]);
  gameState.gold = 50;
  const service = new ItemEffectService({ gameState, itemController });
  assert.equal(service.applyMovementCost(), 4);
  assert.equal(gameState.gold, 46);
});
