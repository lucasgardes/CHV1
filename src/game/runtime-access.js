"use strict";

const RUNTIME_KEY = "__CHV1_GAME_RUNTIME__";

if (!globalThis[RUNTIME_KEY]) {
  globalThis[RUNTIME_KEY] = {
    gameState: null,
    mapController: null,
    itemController: null,
    encounterController: null,
    mapView: null,
    screenController: null,
    runController: null
  };
}

const runtime = globalThis[RUNTIME_KEY];

export function registerGameState(value) { runtime.gameState = value; }
export function registerMapController(value) { runtime.mapController = value; }
export function registerItemController(value) { runtime.itemController = value; }
export function registerEncounterController(value) { runtime.encounterController = value; }
export function registerMapView(value) { runtime.mapView = value; }
export function registerScreenController(value) { runtime.screenController = value; }
export function registerRunController(value) { runtime.runController = value; }
export function getGameRuntime() { return { ...runtime }; }
