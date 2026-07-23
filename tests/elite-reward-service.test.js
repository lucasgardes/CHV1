"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { EliteRewardService } from "../src/game/elite-reward-service.js";

function state(overrides = {}) {
  return {
    inventory: [], upgradedItemIds: [], elitesDefeated: 0, nextEliteRareChanceBonus: 0, gold: 50,
    hasItem(id) { return this.inventory.includes(id); },
    isItemUpgraded(id) { return this.upgradedItemIds.includes(id); },
    addItem(id) { if (this.inventory.includes(id)) return false; this.inventory.push(id); return true; },
    addGold(amount) { this.gold += amount; },
    consumeNextEliteRareChanceBonus() { const value=this.nextEliteRareChanceBonus; this.nextEliteRareChanceBonus=0; return value; },
    ...overrides
  };
}

test("le premier elite garantit au moins un objet et deux recompenses", () => {
  const gameState = state();
  const service = new EliteRewardService({ gameState, random: () => 0.99 });
  const bundle = service.createBundle({ difficulty: 2 });
  assert.equal(bundle.rewards.length, 2);
  assert.equal(bundle.firstElite, true);
  assert.ok(bundle.rewards.some((reward) => reward.type === "item"));
});

test("un elite difficile augmente la chance rare", () => {
  const easy = new EliteRewardService({ gameState: state(), random: () => 0.5 }).getRareChance({ difficulty: 1 });
  const hard = new EliteRewardService({ gameState: state(), random: () => 0.5 }).getRareChance({ difficulty: 3 });
  assert.ok(hard > easy);
});

test("le pari du clown double les recompenses en or", () => {
  const normalState = state();
  const clownState = state({ inventory:["clown-bet"] });
  const normal = new EliteRewardService({ gameState:normalState, random:() => 0 }).createGoldReward({ difficulty:2 });
  const clown = new EliteRewardService({ gameState:clownState, random:() => 0 }).createGoldReward({ difficulty:2 });
  assert.equal(clown.amount, normal.amount * 2);
});

test("le lot applique les objets sans doublon et compte l elite", () => {
  const gameState = state();
  const controller = { initialized:[], ensureRuntimeState(id){ this.initialized.push(id); } };
  const service = new EliteRewardService({ gameState, itemController:controller });
  const bundle = { rewards:[{type:"item",itemId:"time-out",item:{id:"time-out"}},{type:"gold",amount:60}] };
  const applied = service.applyBundle(bundle, { applyGold:false });
  assert.equal(applied.length, 2);
  assert.deepEqual(gameState.inventory,["time-out"]);
  assert.equal(gameState.gold,50);
  assert.equal(gameState.elitesDefeated,1);
});
