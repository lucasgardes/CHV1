"use strict";

import {
  calculatePositionAtTime,
  clamp,
  loadFunscriptActions
} from "./funscript.js";

import {
  FUNSCRIPT_VIEW_CONFIG
} from "./config.js";

export class FunscriptViewController {
  constructor({
    video,
    funscriptPath,
    onActionsChange = () => {}
  }) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Le lecteur vidéo fourni est invalide.");
    }

    if (
      typeof funscriptPath !== "string" ||
      funscriptPath.trim() === ""
    ) {
      throw new Error(
        "Le chemin du funscript est invalide."
      );
    }

    if (typeof onActionsChange !== "function") {
      throw new Error(
        "onActionsChange doit être une fonction."
      );
    }

    this.video = video;
    this.funscriptPath = funscriptPath;
    this.onActionsChange = onActionsChange;

    this.devicePositionElement =
      document.querySelector("#device-position");

    this.funscriptStatusElement =
      document.querySelector("#funscript-status");

    this.positionValueElement =
      document.querySelector("#position-value");

    this.actionIndexElement =
      document.querySelector("#action-index");

    this.actions = [];

    this.validateElements();
  }

  setFunscriptPath(funscriptPath) {
    if (
      typeof funscriptPath !== "string" ||
      funscriptPath.trim().length === 0
    ) {
      throw new TypeError(
        "Le chemin du funscript est invalide."
      );
    }

    this.funscriptPath = funscriptPath;
  }

  validateElements() {
    if (
      !(this.devicePositionElement instanceof HTMLDivElement)
    ) {
      throw new Error(
        "Le simulateur de position est introuvable."
      );
    }

    if (
      !(this.funscriptStatusElement instanceof HTMLElement)
    ) {
      throw new Error(
        "Le statut du funscript est introuvable."
      );
    }

    if (
      !(this.positionValueElement instanceof HTMLElement)
    ) {
      throw new Error(
        "La valeur de position est introuvable."
      );
    }

    if (
      !(this.actionIndexElement instanceof HTMLElement)
    ) {
      throw new Error(
        "L'index des actions est introuvable."
      );
    }
  }

  getActions() {
    return this.actions;
  }

  setActions(actions) {
    this.actions = Array.isArray(actions)
      ? actions
      : [];

    this.onActionsChange(this.actions);
    this.update();
  }

  displayDevicePosition(position) {
    const safePosition = clamp(position, 0, 100);

    const availableTravel =
      FUNSCRIPT_VIEW_CONFIG.simulatorHeightPx -
      FUNSCRIPT_VIEW_CONFIG.positionMarkerHeightPx;
    const bottomPixels =
      (safePosition / 100) * availableTravel;

    this.devicePositionElement.style.bottom =
      `${bottomPixels}px`;

    this.positionValueElement.textContent =
      String(Math.round(safePosition));
  }

  update() {
    const timeMilliseconds =
      this.video.currentTime * 1000;

    const result = calculatePositionAtTime(
      this.actions,
      timeMilliseconds
    );

    this.displayDevicePosition(result.position);

    if (this.actions.length > 0) {
      this.actionIndexElement.textContent =
        `${result.actionIndex + 1} / ` +
        `${this.actions.length}`;
    } else {
      this.actionIndexElement.textContent =
        "0 / 0";
    }
  }

  async load() {
    this.funscriptStatusElement.textContent =
      "Chargement...";

    try {
      const actions = await loadFunscriptActions(
        this.funscriptPath
      );

      this.actions = actions;

      this.funscriptStatusElement.textContent =
        `${this.actions.length} actions chargées`;

      this.onActionsChange(this.actions);
      this.update();

      return this.actions;
    } catch (error) {
      console.error(
        "Erreur de chargement du funscript :",
        error
      );

      this.actions = [];

      this.funscriptStatusElement.textContent =
        "Erreur de chargement";

      this.onActionsChange(this.actions);
      this.update();

      throw error;
    }
  }
}
