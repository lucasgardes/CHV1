"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";
import { RunController } from "./game/run-controller.js";

const button = document.getElementById("declare-defeat-button");

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
      if (video instanceof HTMLVideoElement) video.pause();
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    },
    onStatusChange(message) { if (status) status.textContent = message; }
  });
}

function ensureDialogStyles() {
  if (document.querySelector('link[data-defeat-dialog-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./item-choice-dialog.css";
  link.dataset.defeatDialogStyles = "true";
  document.head.append(link);
}

function confirmDefeat() {
  ensureDialogStyles();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "item-choice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "defeat-dialog-title");

    const dialog = document.createElement("section");
    dialog.className = "item-choice-dialog defeat-confirmation-dialog";
    dialog.innerHTML = `
      <header class="item-choice-dialog__header">
        <span class="item-choice-dialog__icon" aria-hidden="true">!</span>
        <div>
          <p class="item-choice-dialog__eyebrow">Abandon du round</p>
          <h2 id="defeat-dialog-title">Confirmer la défaite ?</h2>
        </div>
      </header>
      <div class="item-choice-dialog__body">
        <p class="item-choice-dialog__message">La vidéo et le funscript seront immédiatement arrêtés.</p>
        <p class="item-choice-dialog__details">Une protection disponible sera consommée et le round sera alors considéré comme réussi. Sans protection, la boucle temporelle recommencera.</p>
      </div>
      <div class="item-choice-dialog__actions">
        <button class="item-choice-dialog__decline" type="button">Continuer le round</button>
        <button class="item-choice-dialog__activate" type="button">Confirmer la défaite</button>
      </div>
    `;

    const finish = (confirmed) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(confirmed);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Enter") finish(true);
    };

    dialog.querySelector(".item-choice-dialog__decline")?.addEventListener("click", () => finish(false));
    dialog.querySelector(".item-choice-dialog__activate")?.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(false); });
    document.addEventListener("keydown", onKeyDown);
    overlay.append(dialog);
    document.body.append(overlay);
    dialog.querySelector(".item-choice-dialog__decline")?.focus();
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
  const status = document.getElementById("video-status");
  if (result.action !== "complete-current-encounter") return;
  if (!runtime.encounterController) throw new Error("Le contrôleur de rencontre n’est pas disponible.");

  const completion = await runtime.encounterController.complete();
  if (!completion) throw new Error("La rencontre protégée n’a pas pu être terminée.");

  if (status) status.textContent = "Protection activée : le round est considéré comme réussi.";

  if (completion.type === "boss") {
    globalThis.__CHV1_PHASE_ONE__?.controller?.completeBoss();
  }
}

window.addEventListener("DOMContentLoaded", () => { try { ensureRunController(); } catch { /* renderer may still be initializing */ } });

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const confirmed = await confirmDefeat();
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";
    try {
      const result = await processDefeat();
      const runtime = getGameRuntime();
      if (result.protected) {
        await applyProtectionResult(result, runtime);
        button.textContent = "Protection activée";
      } else {
        button.textContent = "Boucle relancée";
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
