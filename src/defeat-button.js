"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";
import { RunController } from "./game/run-controller.js";

const button = document.getElementById("declare-defeat-button");

function ensureRunController() {
  const runtime = getGameRuntime();
  if (runtime.runController) return runtime.runController;
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController || !runtime.screenController) {
    throw new Error("La partie n’est pas encore initialisée.");
  }

  const video = document.getElementById("round-video");
  const status = document.getElementById("video-status");
  return new RunController({
    ...runtime,
    video: video instanceof HTMLVideoElement ? video : null,
    async stopEncounter() {
      const emergencyStop = document.getElementById("emergency-stop-button");
      if (emergencyStop instanceof HTMLButtonElement && !emergencyStop.disabled) emergencyStop.click();
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    },
    onStatusChange(message) {
      if (status) status.textContent = message;
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  try { ensureRunController(); } catch { /* renderer may still be initializing */ }
});

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const confirmed = window.confirm("Confirmer la défaite ?\n\nLa vidéo et le funscript seront arrêtés. Une protection sera utilisée si elle est disponible, sinon une nouvelle partie commencera.");
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";

    try {
      const runController = ensureRunController();
      await runController.stopCurrentEncounter();
      const { gameState, mapController } = getGameRuntime();
      const result = new DefeatController({ gameState, mapController }).processDefeat();

      if (result.protected) {
        runController.syncMapDom();
        runController.screenController.showMap();
        button.textContent = "Protection activée";
      } else {
        runController.startNewRun();
        button.textContent = "Nouvelle partie";
      }

      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "J’ai perdu";
      }, 900);
    } catch (error) {
      console.error("Impossible de traiter la défaite :", error);
      button.disabled = false;
      button.textContent = "J’ai perdu";
    }
  });
}
