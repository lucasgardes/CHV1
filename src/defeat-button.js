"use strict";

import { getItemById } from "./data/items.js";
import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";

const button = document.getElementById("declare-defeat-button");

function showMapScreen() {
  const screenIds = [
    "encounter-screen",
    "event-screen",
    "reward-screen",
    "shop-screen",
    "campfire-screen"
  ];

  for (const id of screenIds) {
    const screen = document.getElementById(id);
    if (screen instanceof HTMLElement) screen.hidden = true;
  }

  const mapScreen = document.getElementById("map-screen");
  if (mapScreen instanceof HTMLElement) mapScreen.hidden = false;
}

function updateResources(gameState) {
  const gold = document.getElementById("gold-value");
  if (gold instanceof HTMLElement) gold.textContent = String(gameState.gold);

  const inventory = document.getElementById("inventory-value");
  if (inventory instanceof HTMLElement) {
    inventory.textContent = gameState.inventory.length === 0
      ? "Aucun"
      : gameState.inventory.map((itemId) => {
        const item = getItemById(itemId);
        return `${item?.name ?? itemId}${gameState.isItemUpgraded(itemId) ? " +" : ""}`;
      }).join(", ");
  }
}

async function stopEncounterSafely() {
  const video = document.getElementById("round-video");
  if (video instanceof HTMLVideoElement) video.pause();

  const emergencyStop = document.getElementById("emergency-stop-button");
  if (emergencyStop instanceof HTMLButtonElement && !emergencyStop.disabled) {
    emergencyStop.click();
  }

  await new Promise((resolve) => window.setTimeout(resolve, 150));
}

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;

    const confirmed = window.confirm(
      "Confirmer la défaite ?\n\nLa vidéo et le funscript seront arrêtés. " +
      "Les protections anti-défaite seront vérifiées avant de recommencer la partie."
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";

    try {
      const { gameState, mapController } = getGameRuntime();
      if (!gameState || !mapController) throw new Error("La partie n’est pas encore initialisée.");

      await stopEncounterSafely();

      const result = new DefeatController({ gameState, mapController }).processDefeat();

      if (result.protected) {
        showMapScreen();
        updateResources(gameState);
        button.textContent = "Protection activée";
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = "J’ai perdu";
        }, 1200);
        return;
      }

      button.textContent = "Défaite";
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      console.error("Impossible de traiter la défaite :", error);
      button.disabled = false;
      button.textContent = "J’ai perdu";
    }
  });
}
