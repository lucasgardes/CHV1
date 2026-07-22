"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { DefeatController } from "../src/game/defeat-controller.js";

function createController(gameState) {
  const mapController = { getMap: () => ({ seed: "test-seed" }) };
  gameState.saveResumeSnapshot = () => {};
  gameState.clearResumeSnapshot = () => {};
  return new DefeatController({ gameState, mapController });
}

test("une défaite sans protection termine la partie", () => {
  const gameState = new GameState();
  gameState.startRun("start");
  const result = createController(gameState).processDefeat();
  assert.equal(result.protected, false);
  assert.equal(gameState.status, GAME_STATUS.GAME_OVER);
});

test("Deuxième chance est consommée et protège la partie", () => {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.addItem("second-chance");
  const result = createController(gameState).processDefeat();
  assert.equal(result.protectionId, "second-chance");
  assert.equal(gameState.hasItem("second-chance"), false);
  assert.equal(gameState.status, GAME_STATUS.MAP);
});

test("Dernier rempart ne peut se déclencher qu’une fois", () => {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.addItem("last-stand");
  const controller = createController(gameState);
  assert.equal(controller.processDefeat().protected, true);
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  assert.equal(controller.processDefeat().protected, false);
});
