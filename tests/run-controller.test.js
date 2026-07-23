"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";
import { RunController } from "../src/game/run-controller.js";

function installDocumentStub() {
  globalThis.document = {
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function createFixture({ currentType = "normal" } = {}) {
  installDocumentStub();
  const gameState = new GameState();
  gameState.startRun("previous");
  gameState.completedNodeIds = ["previous"];
  gameState.moveToNode("current");
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.setCurrentEncounter({ nodeId:"current", type:currentType });
  const nodes = new Map([
    ["start", { id:"start", type:"start", nextNodeIds:["previous"] }],
    ["previous", { id:"previous", type:"normal", nextNodeIds:["current"] }],
    ["current", { id:"current", type:currentType, nextNodeIds:["next"] }],
    ["next", { id:"next", type:"normal", nextNodeIds:[] }]
  ]);
  const mapController = {
    getMap: () => ({ startNodeId:"start" }),
    getCurrentNode: () => nodes.get(gameState.currentNodeId) ?? null,
    getNodeById: (id) => nodes.get(id) ?? null,
    getAccessibleNodes: () => (nodes.get(gameState.currentNodeId)?.nextNodeIds ?? []).map((id) => nodes.get(id)).filter(Boolean)
  };
  const itemController = new ItemController({ gameState });
  let stopped = 0;
  const screenController = { showMap() {} };
  const controller = new RunController({ gameState, mapController, itemController, screenController, stopEncounter:async()=>{stopped+=1;} });
  return { gameState, itemController, controller, getStopped:()=>stopped };
}

test("Bouton d’urgence arrête la rencontre, consomme l’objet et applique la pénalité", async () => {
  const fixture = createFixture();
  fixture.gameState.addItem("emergency-button");
  fixture.itemController.resetForRun();
  const result = await fixture.controller.abortEncounterWithEmergencyButton();
  assert.equal(fixture.getStopped(), 1);
  assert.equal(fixture.gameState.hasItem("emergency-button"), false);
  assert.equal(fixture.gameState.status, GAME_STATUS.MAP);
  assert.equal(fixture.gameState.currentNodeId, "previous");
  assert.equal(result.lostGold, 25);
});

test("Protection différée arme la prochaine protection", () => {
  const fixture = createFixture();
  fixture.gameState.addItem("delayed-protection");
  fixture.itemController.resetForRun();
  fixture.controller.armDelayedProtection();
  assert.equal(fixture.gameState.hasItem("delayed-protection"), false);
  assert.equal(fixture.gameState.nextEncounterProtectionArmed, true);
});

test("Raccourci traverse une rencontre normale sans récompense", async () => {
  const fixture = createFixture();
  fixture.gameState.addItem("shortcut");
  fixture.itemController.resetForRun();
  const result = await fixture.controller.skipNormalEncounter();
  assert.equal(result.reward, 0);
  assert.equal(fixture.gameState.completedNodeIds.includes("current"), true);
  assert.equal(fixture.gameState.status, GAME_STATUS.MAP);
});

test("Ticket de sortie quitte la salle et retire vingt or", async () => {
  const fixture = createFixture();
  fixture.gameState.addItem("exit-ticket");
  fixture.itemController.resetForRun();
  const result = await fixture.controller.leaveCurrentRoom();
  assert.equal(result.lostGold, 20);
  assert.equal(fixture.gameState.gold, 30);
  assert.equal(fixture.gameState.currentNodeId, "previous");
});

test("Jeton de fuite quitte un événement et entre en recharge", () => {
  const fixture = createFixture({ currentType:"event" });
  fixture.gameState.setStatus(GAME_STATUS.EVENT);
  fixture.gameState.addItem("escape-token");
  fixture.itemController.resetForRun();
  fixture.controller.escapeEvent();
  assert.equal(fixture.gameState.currentNodeId, "previous");
  assert.equal(fixture.itemController.isAvailable("escape-token"), false);
});
