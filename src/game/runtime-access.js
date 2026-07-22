"use strict";

const RUNTIME_KEY = "__CHV1_GAME_RUNTIME__";

if (!globalThis[RUNTIME_KEY]) {
  globalThis[RUNTIME_KEY] = {
    gameState: null,
    mapController: null,
    itemController: null
  };
}

const runtime = globalThis[RUNTIME_KEY];

export function registerGameState(gameState) { runtime.gameState = gameState; }
export function registerMapController(mapController) { runtime.mapController = mapController; }
export function registerItemController(itemController) { runtime.itemController = itemController; }
export function getGameRuntime() { return { ...runtime }; }
