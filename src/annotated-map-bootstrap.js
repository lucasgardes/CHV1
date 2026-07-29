"use strict";

import { GAME_STATUS } from "./game/game-state.js";
import { getGameRuntime } from "./game/runtime-access.js";

const VIDEO_NODE_TYPES = new Set(["normal", "elite", "boss", "hidden"]);

function renderMap(runtime) {
  runtime.screenController?.showMap();
  runtime.mapView?.render({
    gameState:runtime.gameState,
    currentNode:runtime.mapController.getCurrentNode(),
    accessibleNodes:runtime.mapController.getAccessibleNodes()
  });
}

function useAnnotatedMap(runtime) {
  const { gameState, mapController, encounterController } = runtime;
  if (gameState.status !== GAME_STATUS.MAP || !gameState.hasItem("annotated-map")) return false;
  if (typeof encounterController?.previewEncounterForNode !== "function") return false;

  const targets = mapController.getAccessibleNodes().filter((node) => VIDEO_NODE_TYPES.has(node.type) && node.encounterId);
  if (!targets.length) {
    const status = document.getElementById("video-status");
    if (status) status.textContent = "Carte annotée : aucune rencontre vidéo accessible à révéler.";
    return false;
  }

  const upgraded = gameState.isItemUpgraded("annotated-map");
  const reveals = [];
  for (const node of targets) {
    const encounter = encounterController.previewEncounterForNode(node);
    if (!encounter) continue;
    reveals.push({
      id:node.id,
      title:node.title,
      type:node.type,
      themes:Array.isArray(encounter.themes) ? encounter.themes : [],
      difficulty:upgraded ? (node.difficulty ?? encounter.requestedDifficulty ?? encounter.type ?? null) : null,
      durationSeconds:upgraded ? (Number(encounter.durationSeconds) || 0) : 0,
      showDetails:upgraded
    });
  }

  if (!reveals.length) return false;
  gameState.revealMapEncounters(reveals);
  gameState.removeItem("annotated-map");
  renderMap(runtime);
  const status = document.getElementById("video-status");
  if (status) status.textContent = `Carte annotée utilisée : ${reveals.length} rencontre${reveals.length > 1 ? "s" : ""} révélée${reveals.length > 1 ? "s" : ""}.`;
  return true;
}

function initialize() {
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.encounterController || !runtime.mapView) {
    window.setTimeout(initialize, 100);
    return;
  }
  const mapScreen = document.getElementById("map-screen");
  if (!(mapScreen instanceof HTMLElement) || mapScreen.dataset.annotatedMapReady === "true") return;
  mapScreen.dataset.annotatedMapReady = "true";

  const activate = (target) => {
    const entry = target instanceof Element ? target.closest('[data-item-id="annotated-map"]') : null;
    if (!(entry instanceof HTMLElement)) return;
    useAnnotatedMap(getGameRuntime());
  };

  mapScreen.addEventListener("click", (event) => activate(event.target));
  mapScreen.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const entry = event.target instanceof Element ? event.target.closest('[data-item-id="annotated-map"]') : null;
    if (!(entry instanceof HTMLElement)) return;
    event.preventDefault();
    activate(entry);
  });
}

window.addEventListener("DOMContentLoaded", initialize);
