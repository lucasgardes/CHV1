"use strict";

import "./media-import-bootstrap.js";
import "./encounter-volume-bootstrap.js";
import "./annotated-map-bootstrap.js";
import "./danger-detector-bootstrap.js";
import "./spyglass-bootstrap.js";
import "./peaceful-route-bootstrap.js";
import { getLocalMediaLibrary, scanLocalMediaLibrary } from "./game/local-media-library.js";
import { getGameRuntime } from "./game/runtime-access.js";

function createLocalEncounter(fallback, local, requestedDifficulty) {
  if (!local || local.type === "secret") return fallback;
  return {
    ...fallback,
    id:`local:${local.id}`,
    mediaId:local.id,
    title:local.title,
    videoPath:local.videoPath,
    funscripts:{ ...local.funscripts },
    defaultFunscriptDifficulty:requestedDifficulty,
    requestedDifficulty,
    selectedDifficulty:requestedDifficulty,
    difficulty:requestedDifficulty,
    fallbackUsed:local.fallbackUsed === true,
    durationSeconds:local.durationSeconds || fallback.durationSeconds,
    themes:[...(local.themes ?? [])],
    performers:[...(local.performers ?? [])],
    playbackContext:"run"
  };
}

async function initialize() {
  const library = getLocalMediaLibrary();
  const diagnostics = library.loadScan(await scanLocalMediaLibrary());
  const runtime = getGameRuntime();
  if (!runtime.encounterController || !runtime.mapController || !runtime.gameState) { window.setTimeout(initialize, 100); return; }

  const controller = runtime.encounterController;
  if (controller.__localLibraryConnected) return;
  controller.__localLibraryConnected = true;
  const originalGetEncounterById = controller.getEncounterById.bind(controller);
  const assignedByNodeId = new Map();

  const selectLocalEncounter = (fallback, requestedDifficulty) => {
    if (!fallback) return null;
    let local = library.select({ type:requestedDifficulty, requireFunscript:true });
    if (!local) local = library.select({ type:fallback.type, difficulty:requestedDifficulty, requireFunscript:true });
    return createLocalEncounter(fallback, local, requestedDifficulty);
  };

  controller.previewEncounterForNode = (node) => {
    if (!node?.id || !node.encounterId) return null;
    if (assignedByNodeId.has(node.id)) return assignedByNodeId.get(node.id);
    const fallback = originalGetEncounterById(node.encounterId);
    if (!fallback) return null;
    const requestedDifficulty = node.difficulty ?? fallback.defaultFunscriptDifficulty ?? fallback.difficulty ?? "normal";
    const selected = selectLocalEncounter(fallback, requestedDifficulty);
    assignedByNodeId.set(node.id, selected);
    return selected;
  };

  controller.getDirectorAlternative = (currentEncounter) => {
    const currentDifficulty = currentEncounter?.requestedDifficulty ?? currentEncounter?.selectedDifficulty ?? currentEncounter?.difficulty ?? "normal";
    const currentMediaId = currentEncounter?.mediaId ?? (String(currentEncounter?.id ?? "").startsWith("local:") ? String(currentEncounter.id).slice(6) : null);
    const playedIds = runtime.gameState.itemRunState?.playedMediaIds ?? [];
    const local = library.selectDirectorAlternative({
      difficulty:currentDifficulty,
      currentId:currentMediaId,
      playedIds
    });
    return local ? createLocalEncounter(currentEncounter, local, local.selectedDifficulty ?? local.type ?? currentDifficulty) : null;
  };

  controller.getEncounterById = (encounterId) => {
    const currentNode = runtime.mapController.getCurrentNode();
    if (currentNode?.encounterId === encounterId && ["normal", "elite", "boss", "hidden"].includes(currentNode.type)) {
      return controller.previewEncounterForNode(currentNode);
    }
    const fallback = originalGetEncounterById(encounterId);
    if (!fallback) return null;
    const requestedDifficulty = fallback.defaultFunscriptDifficulty ?? fallback.difficulty ?? "normal";
    return selectLocalEncounter(fallback, requestedDifficulty);
  };

  const status = document.getElementById("video-status");
  if (status && diagnostics.missingDirectory) status.textContent = "Bibliothèque locale absente : médias intégrés utilisés.";
  else if (status && diagnostics.readyCount === 0) status.textContent = "Aucune vidéo locale valide : médias intégrés utilisés.";
}

window.addEventListener("DOMContentLoaded", initialize);