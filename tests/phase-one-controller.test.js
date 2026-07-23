"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { LocalSaveService } from "../src/game/local-save.js";
import { PhaseOneController, ENDINGS } from "../src/game/phase-one-controller.js";

function memoryStorage() {
  const values = new Map();
  return { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value), removeItem:key => values.delete(key) };
}

function createController({ protectedDefeat = false } = {}) {
  const gameState = new GameState();
  const map = { startNodeId:"start", nodes:[{ id:"hidden-1", type:"hidden" }] };
  const transitions = [];
  const controller = new PhaseOneController({
    gameState,
    mapController:{ getMap:() => map },
    itemController:{ resetForRun() {} },
    defeatController:{ processDefeat:() => ({ protected:protectedDefeat, restartRun:!protectedDefeat }) },
    saveService:new LocalSaveService({ storage:memoryStorage() }),
    onTransition:transition => transitions.push(transition)
  });
  return { controller, gameState, transitions };
}

test("une défaite crée une nouvelle boucle persistante", async () => {
  const { controller, gameState, transitions } = createController();
  controller.startRun();
  const result = await controller.processDefeat();
  assert.equal(result.loopCount, 1);
  assert.equal(gameState.status, GAME_STATUS.GAME_OVER);
  assert.equal(controller.getMeta().defeats, 1);
  assert.equal(transitions.at(-1).type, "white-space");
});

test("une protection empêche l'incrément de boucle", async () => {
  const { controller } = createController({ protectedDefeat:true });
  controller.startRun();
  const result = await controller.processDefeat();
  assert.equal(result.protected, true);
  assert.equal(controller.getMeta().loopCount, 0);
});

test("le boss produit la mauvaise fin sans objet spécial", () => {
  const { controller, gameState } = createController();
  controller.startRun();
  assert.equal(controller.completeBoss().ending, ENDINGS.BAD);
  assert.equal(gameState.status, GAME_STATUS.VICTORY);
});

test("la Clé du dernier acte débloque la bonne fin et la rencontre cachée", () => {
  const { controller, gameState } = createController();
  controller.startRun();
  gameState.addItem("last-act-key");
  assert.equal(controller.revealHiddenEncounter().id, "hidden-1");
  assert.equal(controller.completeBoss().ending, ENDINGS.GOOD);
  assert.ok(controller.getMeta().unlockedContent.includes("true-ending"));
});
