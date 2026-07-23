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
    const local = library.select({ type:fallback.type, difficulty:fallback.difficulty, requireFunscript:true });
    if (!local) return fallback;
    return {
      ...fallback,
      id:`local:${local.id}`,
      title:local.title,
      videoPath:local.videoPath,
      funscripts:{ easy:local.funscriptPath, medium:local.funscriptPath, hard:local.funscriptPath },
      defaultFunscriptDifficulty:fallback.defaultFunscriptDifficulty,
      durationSeconds:local.durationSeconds || fallback.durationSeconds
    };
  };

  const status = document.getElementById("video-status");
  if (status && diagnostics.missingDirectory) status.textContent = "Bibliothèque locale absente : médias intégrés utilisés.";
  else if (status && diagnostics.readyCount === 0) status.textContent = "Aucune paire vidéo/funscript locale valide : médias intégrés utilisés.";
}

window.addEventListener("DOMContentLoaded", initialize);
