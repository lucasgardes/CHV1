"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../src/game/game-state.js";
import { EventEngine } from "../src/game/event-engine.js";
import { EventItemActions } from "../src/game/event-item-actions.js";

const EVENTS = [
  { id:"current", category:"negative", choices:[{ id:"bad", label:"Perdre", effect:{ type:"lose-gold", amount:20 } }] },
  { id:"positive", category:"positive", choices:[{ id:"good", label:"Gagner", effect:{ type:"gain-gold", amount:30 } }] },
  { id:"neutral", category:"neutral", choices:[{ id:"wait", label:"Attendre", effect:{ type:"none" } }] }
];

function setup(itemId, upgraded = false) {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.addItem(itemId);
  if (upgraded) gameState.upgradeItem(itemId);
  gameState.markEventSeen("current");
  const eventEngine = new EventEngine({ events:EVENTS, gameState, random:() => 0 });
  return { gameState, actions:new EventItemActions({ gameState, eventEngine }) };
}

test("Pièce truquée remplace un événement et est consommée", () => {
  const { gameState, actions } = setup("rigged-coin");
  const candidates = actions.useRiggedCoin(EVENTS[0]);
  assert.equal(candidates.length, 1);
  assert.equal(gameState.hasItem("rigged-coin"), false);
});

test("Pièce truquée améliorée propose deux résultats", () => {
  const { actions } = setup("rigged-coin", true);
  assert.equal(actions.useRiggedCoin(EVENTS[0]).length, 2);
});

test("Contrat vierge remplace une option négative", () => {
  const { gameState, actions } = setup("blank-contract");
  const replaced = actions.useBlankContract(EVENTS[0]);
  assert.ok(replaced);
  assert.equal(replaced.choices[0].label, "Option inconnue");
  assert.equal(gameState.hasItem("blank-contract"), false);
});

test("Contrat vierge amélioré révèle la catégorie", () => {
  const { actions } = setup("blank-contract", true);
  const replaced = actions.useBlankContract(EVENTS[0]);
  assert.match(replaced.choices[0].label, /positive|neutral/);
});