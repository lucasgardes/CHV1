"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";

const button = document.getElementById("declare-defeat-button");

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;

    const confirmed = window.confirm(
      "Confirmer la défaite ?\n\nLa vidéo et le funscript seront arrêtés. Les protections anti-défaite seront ensuite vérifiées ; sans protection, la partie recommencera depuis le début."
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";

    try {
      const video = document.getElementById("round-video");
      if (video instanceof HTMLVideoElement && !video.paused) video.pause();

      const emergencyStop = document.getElementById("emergency-stop-button");
      if (emergencyStop instanceof HTMLButtonElement && !emergencyStop.disabled) emergencyStop.click();

      await new Promise((resolve) => window.setTimeout(resolve, 150));

      const { gameState, mapController } = getGameRuntime();
      if (!gameState || !mapController) throw new Error("La partie n’est pas encore initialisée.");

      const result = new DefeatController({ gameState, mapController }).processDefeat();
      button.textContent = result.protected ? "Protection activée" : "Défaite";
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      console.error("Impossible de traiter la défaite :", error);
      button.disabled = false;
      button.textContent = "J’ai perdu";
    }
  });
}
