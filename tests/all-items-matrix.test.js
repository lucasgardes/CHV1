"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import {
  ITEMS,
  ITEM_TYPES,
  getItemById,
  getItemValues,
  getItemRecharge
} from "../src/data/items.js";
import { ItemController } from "../src/item-controller.js";

function createGameState(itemIds, upgradedItemIds = []) {
  const inventory = [...itemIds];
  const upgraded = new Set(upgradedItemIds);
  const disabled = new Set();

  return {
    inventory,
    hasItem(itemId) {
      return inventory.includes(itemId);
    },
    isItemUpgraded(itemId) {
      return upgraded.has(itemId);
    },
    isItemDisabled(itemId) {
      return disabled.has(itemId);
    },
    disableItem(itemId) {
      disabled.add(itemId);
    },
    enableItem(itemId) {
      disabled.delete(itemId);
    }
  };
}

const implementedItems = ITEMS.filter((item) => item.implemented !== false);
const deferredItems = ITEMS.filter((item) => item.implemented === false);

function allPairs(values) {
  const pairs = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      pairs.push([values[left], values[right]]);
    }
  }
  return pairs;
}

test("chaque objet possède une définition exploitable par les tests", () => {
  const ids = new Set();

  for (const item of ITEMS) {
    assert.equal(typeof item.id, "string");
    assert.ok(item.id.length > 0, "Un objet possède un identifiant vide.");
    assert.equal(ids.has(item.id), false, `Identifiant d’objet dupliqué : ${item.id}`);
    ids.add(item.id);

    assert.equal(typeof item.name, "string", `${item.id} n’a pas de nom.`);
    assert.ok(Object.values(ITEM_TYPES).includes(item.type), `${item.id} a un type invalide.`);
    assert.equal(typeof item.effect?.type, "string", `${item.id} n’a pas de type d’effet.`);
    assert.ok(getItemById(item.id), `${item.id} est absent de l’index des objets.`);
    assert.doesNotThrow(() => getItemValues(item.id, false));
    assert.doesNotThrow(() => getItemRecharge(item.id, false));
  }
});

for (const item of implementedItems) {
  test(`objet seul : ${item.name} (${item.id})`, () => {
    const gameState = createGameState([item.id]);
    const controller = new ItemController({ gameState });

    controller.resetForRun();

    assert.equal(controller.hasItem(item.id), true);
    assert.deepEqual(controller.getEffectiveValues(item.id), getItemValues(item.id, false));
    assert.deepEqual(controller.getEffectiveRecharge(item.id), getItemRecharge(item.id, false));

    const state = controller.getState(item.id);
    assert.equal(state.available, true);
    assert.equal(state.active, false);
    assert.equal(state.disabled, false);
  });

  if (item.upgrade) {
    test(`objet amélioré : ${item.name} (${item.id})`, () => {
      const gameState = createGameState([item.id], [item.id]);
      const controller = new ItemController({ gameState });

      controller.resetForRun();

      assert.deepEqual(controller.getEffectiveValues(item.id), getItemValues(item.id, true));
      assert.deepEqual(controller.getEffectiveRecharge(item.id), getItemRecharge(item.id, true));
    });
  }
}

for (const [left, right] of allPairs(implementedItems)) {
  test(`compatibilité paire : ${left.id} + ${right.id}`, () => {
    const gameState = createGameState([left.id, right.id]);
    const controller = new ItemController({ gameState });

    controller.resetForRun();
    controller.resetForEncounter();

    const leftBefore = controller.getState(left.id);
    const rightBefore = controller.getState(right.id);
    assert.equal(leftBefore.available, true);
    assert.equal(rightBefore.available, true);

    // Consommer une charge ne doit jamais modifier l’état de l’autre objet.
    controller.consumeCharge(left.id);
    const rightAfterLeft = controller.getState(right.id);
    assert.equal(rightAfterLeft.available, rightBefore.available);
    assert.equal(rightAfterLeft.active, rightBefore.active);

    // Une fin d’activation et l’avancement des recharges doivent rester sûrs,
    // quelle que soit la combinaison de types d’objets.
    controller.finishActivation(left.id);
    assert.doesNotThrow(() => controller.advanceRechargeCounters({ encounterType: "normal" }));
    assert.doesNotThrow(() => controller.advanceRechargeCounters({ encounterType: "elite" }));

    assert.equal(controller.hasItem(left.id), true);
    assert.equal(controller.hasItem(right.id), true);
  });
}

test("les objets différés sont explicitement documentés", () => {
  for (const item of deferredItems) {
    assert.equal(typeof item.deferredReason, "string", `${item.id} doit indiquer deferredReason.`);
    assert.ok(item.deferredReason.length > 0, `${item.id} a une raison de report vide.`);
  }
});
