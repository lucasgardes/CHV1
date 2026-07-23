"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { getItemById, getItemValues } from "../src/data/items.js";
import { AdvancedItemService } from "../src/game/advanced-item-service.js";

function createState(items = []) {
  return {
    inventory:[...items], upgradedItemIds:[], itemRunState:null,
    hasItem(id){return this.inventory.includes(id);},
    isItemUpgraded(id){return this.upgradedItemIds.includes(id);}
  };
}

function createItemController(state) {
  return { getEffectiveValues(id){return getItemValues(id,state.isItemUpgraded(id));} };
}

test("catalogue officiel corrige les objets historiques", () => {
  assert.equal(getItemById("shortcut").values.seconds, 30);
  assert.equal(getItemById("fragmentation").values.pauseSeconds, 20);
  assert.equal(getItemById("dubious-coupon").values.choices, 1);
  assert.equal(getItemById("controlled-breath").deferredReason, "intensity-sync");
});

test("ceinture utilitaire augmente la capacité active", () => {
  const state=createState(["utility-belt"]);
  const service=new AdvancedItemService({gameState:state,itemController:createItemController(state)});
  service.resetForRun();
  assert.equal(service.getActiveItemCapacity(),4);
  state.upgradedItemIds.push("utility-belt");
  assert.equal(service.getActiveItemCapacity(),5);
});

test("double commande ne se déclenche qu'une fois", () => {
  const state=createState(["double-command"]);
  const service=new AdvancedItemService({gameState:state,itemController:createItemController(state)});
  service.resetForRun();
  service.state().doubleCommandStoredItemId="time-out";
  assert.equal(service.consumeDoubleCommand("time-out"),true);
  assert.equal(service.consumeDoubleCommand("time-out"),false);
});

test("métronome progresse sans objet de secours", () => {
  const state=createState(["metronome"]);
  const service=new AdvancedItemService({gameState:state,itemController:createItemController(state)});
  service.resetForRun();
  service.beginEncounter();
  assert.equal(service.completeEncounterWithoutRescue(),.05);
  service.beginEncounter();
  assert.equal(service.completeEncounterWithoutRescue(),.1);
  service.markRescueItemUsed();
  assert.equal(service.completeEncounterWithoutRescue(),0);
});
