"use strict";

const runtime = {
  gameState: null,
  mapController: null,
  itemController: null
};

export function registerGameState(gameState) {
  runtime.gameState = gameState;
}

export function registerMapController(mapController) {
  runtime.mapController = mapController;
}

export function registerItemController(itemController) {
  runtime.itemController = itemController;
}

export function getGameRuntime() {
  return { ...runtime };
}
