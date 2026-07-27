"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { ITEMS } from "../src/data/items.js";
import { GAME_STATUS, GameState } from "../src/game/game-state.js";
import { MapController } from "../src/game/map/map-controller.js";

test("une partie de test démarre sur la carte avec tous les objets", () => {
  const gameState = new GameState();

  gameState.startRun("start");

  assert.equal(gameState.status, GAME_STATUS.MAP);
  assert.equal(gameState.currentNodeId, "start");
  assert.deepEqual(gameState.inventory, ITEMS.map((item) => item.id));
});

test("la première destination accessible peut être rejointe", () => {
  const gameState = new GameState();
  const mapController = new MapController({ gameState, seed: 12345 });
  gameState.startRun(mapController.getMap().startNodeId);

  const [destination] = mapController.getAccessibleNodes();
  assert.ok(destination, "la carte doit proposer au moins une destination");

  const movedNode = mapController.moveToNode(destination.id);

  assert.equal(movedNode.id, destination.id);
  assert.equal(gameState.currentNodeId, destination.id);
  assert.equal(gameState.completedNodeIds.includes("start"), true);
});

test("une case inaccessible est refusée", () => {
  const gameState = new GameState();
  const mapController = new MapController({ gameState, seed: 12345 });
  gameState.startRun(mapController.getMap().startNodeId);

  const bossNodeId = mapController.getMap().bossNodeId;

  assert.throws(
    () => mapController.moveToNode(bossNodeId),
    /n’est pas accessible/
  );
  assert.equal(gameState.currentNodeId, "start");
});

test("la rencontre cachée n'est révélée qu'une seule fois", () => {
  const gameState = new GameState();
  const mapController = new MapController({ gameState, seed: 98765 });
  const hiddenConnection = mapController.getMap().hiddenConnection;
  const hiddenNode = mapController.getNodeById(hiddenConnection.nodeId);
  const sourceNode = mapController.getNodeById(hiddenConnection.sourceNodeId);

  assert.equal(hiddenNode.hidden, true);
  assert.equal(sourceNode.nextNodeIds.includes(hiddenNode.id), false);

  const firstReveal = mapController.revealHiddenEncounter();
  const secondReveal = mapController.revealHiddenEncounter();

  assert.equal(firstReveal, hiddenNode);
  assert.equal(hiddenNode.hidden, false);
  assert.equal(sourceNode.nextNodeIds.filter((id) => id === hiddenNode.id).length, 1);
  assert.equal(secondReveal, null);
});

test("les récompenses différées sont accordées au bon nombre de rencontres", () => {
  const gameState = new GameState();
  const startingGold = gameState.gold;

  gameState.queueDeferredEncounterReward({
    id: "functional-test-reward",
    source: "test",
    encounters: 2,
    gold: 30
  });

  assert.deepEqual(gameState.advanceDeferredEncounterRewards(), []);
  assert.equal(gameState.gold, startingGold);

  const granted = gameState.advanceDeferredEncounterRewards();

  assert.equal(granted.length, 1);
  assert.equal(granted[0].gold, 30);
  assert.equal(gameState.gold, startingGold + 30);
  assert.deepEqual(gameState.getDeferredEncounterRewards(), []);
});

test("un objet désactivé redevient disponible après le nombre prévu de rencontres", () => {
  const gameState = new GameState();
  gameState.addItem("metronome");

  assert.equal(gameState.disableItem("metronome", 2), true);
  assert.equal(gameState.isItemDisabled("metronome"), true);

  gameState.advanceDisabledItems();
  assert.equal(gameState.isItemDisabled("metronome"), true);

  gameState.advanceDisabledItems();
  assert.equal(gameState.isItemDisabled("metronome"), false);
});
