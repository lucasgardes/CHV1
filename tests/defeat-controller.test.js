"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { DefeatController } from "../src/game/defeat-controller.js";

function createController(gameState) {
  const nodes = new Map([
    ["start", { id: "start", nextNodeIds: ["encounter"] }],
    ["encounter", { id: "encounter", nextNodeIds: ["next"] }],
    ["next", { id: "next", nextNodeIds: [] }]
  ]);
  const mapController = {
    getMap: () => ({ seed: "test-seed", startNodeId: "start" }),
    getCurrentNode: () => nodes.get(gameState.currentNodeId) ?? null,
    getNodeById: (nodeId) => nodes.get(nodeId) ?? null
  };
  gameState.clearResumeSnapshot = () => {};
  return new DefeatController({ gameState, mapController });
}

function moveIntoEncounter(gameState) {
  gameState.startRun("start");
  gameState.completeCurrentNode();
  gameState.moveToNode("encounter");
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.setCurrentEncounter({ nodeId: "encounter", encounterId: "normal-001" });
}

test("une défaite sans protection termine la partie", () => {
  const gameState = new GameState();
  moveIntoEncounter(gameState);
  const result = createController(gameState).processDefeat();
  assert.equal(result.protected, false);
  assert.equal(result.restartRun, true);
  assert.equal(gameState.status, GAME_STATUS.GAME_OVER);
});

test("Deuxième chance est consommée et ramène à la case précédente", () => {
  const gameState = new GameState();
  moveIntoEncounter(gameState);
  gameState.addItem("second-chance");

  const result = createController(gameState).processDefeat();

  assert.equal(result.protectionId, "second-chance");
  assert.equal(result.returnNodeId, "start");
  assert.equal(result.restartRun, false);
  assert.equal(gameState.hasItem("second-chance"), false);
  assert.equal(gameState.currentNodeId, "start");
  assert.equal(gameState.currentEncounter, null);
  assert.equal(gameState.status, GAME_STATUS.MAP);
});

test("Dernier rempart ne peut se déclencher qu’une fois", () => {
  const gameState = new GameState();
  moveIntoEncounter(gameState);
  gameState.addItem("last-stand");
  const controller = createController(gameState);

  assert.equal(controller.processDefeat().protected, true);

  gameState.moveToNode("encounter");
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.setCurrentEncounter({ nodeId: "encounter", encounterId: "normal-001" });
  assert.equal(controller.processDefeat().protected, false);
});
