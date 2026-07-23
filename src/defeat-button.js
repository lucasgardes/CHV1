"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";
import { RunController } from "./game/run-controller.js";

const button = document.getElementById("declare-defeat-button");
const CHECKPOINT_SEGMENT_SECONDS = 60;

function ensureRunController() {
  const runtime = getGameRuntime();
  if (runtime.runController) return runtime.runController;
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController || !runtime.screenController) throw new Error("La partie n’est pas encore initialisée.");
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
    onStatusChange(message) { if (status) status.textContent = message; }
  });
}

async function processDefeat() {
  if (globalThis.__CHV1_PHASE_ONE__?.processDefeat) return globalThis.__CHV1_PHASE_ONE__.processDefeat();
  const runController = ensureRunController();
  await runController.stopCurrentEncounter();
  const { gameState, mapController, itemController } = getGameRuntime();
  return new DefeatController({ gameState, mapController, itemController }).processDefeat();
}

async function applyProtectionResult(result, runtime) {
  const video = document.getElementById("round-video");
  const status = document.getElementById("video-status");
  if (result.action === "restart-current-encounter" && video instanceof HTMLVideoElement) {
    runtime.screenController?.showEncounter();
    video.currentTime = 0;
    if (result.pauseSeconds > 0) await new Promise((resolve) => window.setTimeout(resolve, result.pauseSeconds * 1000));
    await video.play();
    if (status) status.textContent = "Deuxième chance : round recommencé.";
    return;
  }
  if (result.action === "rewind-current-encounter" && video instanceof HTMLVideoElement) {
    runtime.screenController?.showEncounter();
    video.currentTime = Math.max(0, video.currentTime - result.rewindRounds * CHECKPOINT_SEGMENT_SECONDS);
    await video.play();
    if (status) status.textContent = `Mini-checkpoint : retour de ${result.rewindRounds} segment${result.rewindRounds > 1 ? "s" : ""}.`;
    return;
  }
  runtime.runController?.syncMapDom();
  runtime.screenController?.showMap();
  if (status && result.action === "complete-encounter") status.textContent = `Protection différée : round validé, +${result.reward ?? 0} or.`;
}

window.addEventListener("DOMContentLoaded", () => { try { ensureRunController(); } catch { /* renderer may still be initializing */ } });

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const confirmed = window.confirm("Confirmer la défaite ?\n\nLa vidéo et le funscript seront arrêtés. Une protection sera utilisée si elle est disponible, sinon la boucle temporelle recommencera.");
    if (!confirmed) return;
    button.disabled = true;
    button.textContent = "Traitement...";
    try {
      const result = await processDefeat();
      const runtime = getGameRuntime();
      if (result.protected) {
        await applyProtectionResult(result, runtime);
        button.textContent = "Protection activée";
      } else button.textContent = "Boucle relancée";
      window.setTimeout(() => { button.disabled = false; button.textContent = "J’ai perdu"; }, 900);
    } catch (error) {
      console.error("Impossible de traiter la défaite :", error);
      button.disabled = false;
      button.textContent = "J’ai perdu";
    }
  });
}
