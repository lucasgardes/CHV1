"use strict";

import { getLocalMediaLibrary, scanLocalMediaLibrary } from "./game/local-media-library.js";
import { getGameRuntime } from "./game/runtime-access.js";

async function initialize() {
  const library = getLocalMediaLibrary();
  const diagnostics = library.loadScan(await scanLocalMediaLibrary());
  const runtime = getGameRuntime();
  if (!runtime.encounterController) { window.setTimeout(initialize, 100); return; }

  const controller = runtime.encounterController;
  if (controller.__localLibraryConnected) return;
  controller.__localLibraryConnected = true;
  const originalGetEncounterById = controller.getEncounterById.bind(controller);
  controller.getEncounterById = (encounterId) => {
    const fallback = originalGetEncounterById(encounterId);
    if (!fallback) return null;
    const requestedDifficulty = fallback.defaultFunscriptDifficulty ?? fallback.difficulty ?? "normal";
    const local = library.select({ type:fallback.type, difficulty:requestedDifficulty, requireFunscript:true });
    if (!local || local.type === "secret") return fallback;
    const selectedDifficulty = local.selectedDifficulty ?? requestedDifficulty;
    return {
      ...fallback,
      id:`local:${local.id}`,
      mediaId:local.id,
      title:local.title,
      videoPath:local.videoPath,
      funscripts:{ ...local.funscripts },
      defaultFunscriptDifficulty:selectedDifficulty,
      requestedDifficulty:local.requestedDifficulty,
      selectedDifficulty,
      fallbackUsed:local.fallbackUsed,
      durationSeconds:local.durationSeconds || fallback.durationSeconds,
      themes:local.themes,
      performers:local.performers,
      playbackContext:local.type === "event" ? "event" : "run"
    };
  };

  const status = document.getElementById("video-status");
  if (status && diagnostics.missingDirectory) status.textContent = "Bibliothèque locale absente : médias intégrés utilisés.";
  else if (status && diagnostics.readyCount === 0) status.textContent = "Aucune vidéo locale valide : médias intégrés utilisés.";
}

window.addEventListener("DOMContentLoaded", initialize);
