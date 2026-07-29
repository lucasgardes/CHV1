"use strict";

import { getGameRuntime } from "./game/runtime-access.js";

function canRestoreLastStand(gameState) {
  return gameState?.hasItem?.("last-stand") === true
    && gameState?.isDefeatProtectionConsumed?.("last-stand") === true;
}

function applyRestGraceState(runtime) {
  const restButton = document.getElementById("campfire-rest-button");
  if (!(restButton instanceof HTMLButtonElement)) return;

  const active = runtime.gameState?.activeBlessingId === "rest-grace";
  const lastStandRestorable = canRestoreLastStand(runtime.gameState);
  const disabled = active && !lastStandRestorable;

  restButton.disabled = disabled;
  restButton.setAttribute("aria-disabled", String(disabled));
  restButton.title = disabled
    ? "Grâce du repos a déjà rechargé les objets rechargeables : cette action est indisponible."
    : active && lastStandRestorable
      ? "Se reposer permet encore de restaurer Dernier rempart."
      : "";

  if (disabled) {
    restButton.dataset.originalLabel ||= restButton.textContent ?? "Se reposer";
    restButton.textContent = "Repos déjà accordé";
    restButton.classList.add("is-rest-grace-disabled");
  } else {
    restButton.textContent = active && lastStandRestorable
      ? "Restaurer Dernier rempart"
      : (restButton.dataset.originalLabel || "Se reposer");
    restButton.classList.remove("is-rest-grace-disabled");
  }
}

function ensureStyles() {
  if (document.querySelector('style[data-rest-grace-styles="true"]')) return;
  const style = document.createElement("style");
  style.dataset.restGraceStyles = "true";
  style.textContent = `
    #campfire-rest-button.is-rest-grace-disabled {
      opacity: .45;
      filter: grayscale(.45);
      cursor: not-allowed;
      box-shadow: none;
    }
  `;
  document.head.append(style);
}

function initialize() {
  const runtime = getGameRuntime();
  if (!runtime.roomController || !runtime.campfireView || !runtime.gameState) {
    window.setTimeout(initialize, 100);
    return;
  }
  if (runtime.campfireView.__restGraceConnected) return;
  runtime.campfireView.__restGraceConnected = true;
  ensureStyles();

  const originalShow = runtime.campfireView.show.bind(runtime.campfireView);
  runtime.campfireView.show = (...args) => {
    const result = originalShow(...args);
    applyRestGraceState(runtime);
    return result;
  };
}

window.addEventListener("DOMContentLoaded", initialize);
