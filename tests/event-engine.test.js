"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../src/game/game-state.js";
import { EventEngine } from "../src/game/event-engine.js";
import { EventResolver } from "../src/game/event-resolver.js";

const EVENTS = [
  { id:"positive-a", category:"positive" },
  { id:"positive-b", category:"positive" },
  { id:"neutral-a", category:"neutral" },
  { id:"negative-a", category:"negative" }
];

function createState() {
  const state = new GameState();
  state.startRun("start");
  return state;
}

test("les événements attribués à une carte sont uniques", () => {
  const gameState = createState();
  const engine = new EventEngine({ events:EVENTS, gameState, random:() => 0 });
  const nodes = [{ id:"a", type:"event" }, { id:"b", type:"event" }, { id:"c", type:"normal" }];
  const assignments = engine.assignToNodes(nodes);
  assert.equal(assignments.length, 2);
  assert.notEqual(nodes[0].eventId, nodes[1].eventId);
  assert.equal(gameState.seenEventIds.length, 2);
});

test("une catégorie imposée est respectée", () => {
  const gameState = createState();
  const engine = new EventEngine({ events:EVENTS, gameState, random:() => 0.5 });
  assert.equal(engine.draw({ category:"negative" }).id, "negative-a");
});

test("les effets différés sont consommés sur la rencontre suivante", async () => {
  const gameState = createState();
  const resolver = new EventResolver({ gameState, random:() => 0 });
  await resolver.resolve({ type:"next-duration", seconds:20 });
  await resolver.resolve({ type:"next-reward", goldFlat:-30 });
  const modifiers = gameState.consumeEncounterModifiers();
  assert.equal(modifiers.length, 2);
  assert.equal(modifiers[0].durationSeconds, 20);
  assert.equal(modifiers[1].rewardGoldFlat, -30);
  assert.equal(gameState.pendingEncounterModifiers.length, 0);
});

test("une relation avec un cobaye est conservée pendant la partie", async () => {
  const gameState = createState();
  const resolver = new EventResolver({ gameState });
  await resolver.resolve({ type:"relation", cobayeId:"hungry", amount:1 });
  await resolver.resolve({ type:"relation", cobayeId:"hungry", amount:-2 });
  assert.equal(gameState.cobayeRelations.hungry, -1);
});

test("un effet composé applique toutes ses conséquences", async () => {
  const gameState = createState();
  const resolver = new EventResolver({ gameState });
  const result = await resolver.resolve({ type:"compound", effects:[
    { type:"gain-gold", amount:30 },
    { type:"set-flag", flag:"obedience-chest-opened" }
  ] });
  assert.equal(result.results.length, 2);
  assert.equal(gameState.gold, 80);
  assert.equal(gameState.getEventFlag("obedience-chest-opened"), true);
});