"use strict";

import { getItemById } from "../data/items.js";

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class ActiveItemController {
  constructor({
    gameState,
    itemController,
    video,
    onStateChange = () => {},
    onStatusChange = () => {}
  }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Le lecteur vidéo est invalide.");
    }
    if (typeof onStateChange !== "function") {
      throw new TypeError("onStateChange doit être une fonction.");
    }
    if (typeof onStatusChange !== "function") {
      throw new TypeError("onStatusChange doit être une fonction.");
    }

    this.gameState = gameState;
    this.itemController = itemController;
    this.video = video;
    this.onStateChange = onStateChange;
    this.onStatusChange = onStatusChange;
    this.activeOperation = null;
    this.operationId = 0;
  }

  isBusy() {
    return this.activeOperation !== null;
  }

  canUse(itemId) {
    return (
      this.gameState.status === "encounter" &&
      !this.video.paused &&
      !this.video.ended &&
      !this.isBusy() &&
      this.itemController.isAvailable(itemId)
    );
  }

  getItemModel(itemId) {
    const item = getItemById(itemId);
    const state = this.itemController.getState(itemId);
    const upgraded = this.gameState.isItemUpgraded(itemId);
    const suffix = upgraded ? " +" : "";

    let statusLabel = "disponible";
    if (state.active) {
      statusLabel = "actif";
    } else if (!state.available) {
      const rounds = state.remainingRechargeRounds;
      statusLabel = `recharge dans ${rounds} rencontre${rounds > 1 ? "s" : ""}`;
    }

    return {
      id: itemId,
      name: `${item?.name ?? itemId}${suffix}`,
      upgraded,
      available: state.available,
      active: state.active,
      remainingRechargeRounds: state.remainingRechargeRounds,
      statusLabel,
      disabled: !this.canUse(itemId),
      title: item?.description ?? ""
    };
  }

  async use(itemId) {
    if (!this.canUse(itemId)) {
      throw new Error(`L’objet ${itemId} ne peut pas être utilisé maintenant.`);
    }

    const item = getItemById(itemId);
    if (!item?.effect?.type) {
      throw new Error(`L’objet ${itemId} ne possède aucun effet actif implémenté.`);
    }

    const currentOperationId = ++this.operationId;
    this.activeOperation = {
      id: currentOperationId,
      itemId,
      cancelled: false
    };

    this.itemController.activate(itemId);
    this.itemController.consumeCharge(itemId);
    this.onStateChange();

    try {
      switch (item.effect.type) {
        case "pause-video":
          await this.runPauseEffect(itemId, currentOperationId);
          break;
        case "hide-video":
          await this.runHideEffect(itemId, currentOperationId);
          break;
        case "mute-video":
          await this.runMuteEffect(itemId, currentOperationId);
          break;
        default:
          throw new Error(`Effet actif inconnu : ${item.effect.type}`);
      }
    } finally {
      this.itemController.finishActivation(itemId);
      if (this.activeOperation?.id === currentOperationId) {
        this.activeOperation = null;
      }
      this.onStateChange();
    }
  }

  async countdown(itemId, operationId, durationSeconds, label) {
    for (let remaining = durationSeconds; remaining > 0; remaining -= 1) {
      if (!this.isOperationValid(operationId)) return false;
      this.onStatusChange(
        `${label} actif : ${remaining} seconde${remaining > 1 ? "s" : ""}.`
      );
      await wait(1000);
    }

    return this.isOperationValid(operationId);
  }

  isOperationValid(operationId) {
    return (
      this.activeOperation?.id === operationId &&
      this.activeOperation.cancelled === false &&
      this.gameState.status === "encounter"
    );
  }

  async runPauseEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);

    this.video.pause();
    const completed = await this.countdown(
      itemId,
      operationId,
      durationSeconds,
      item?.name ?? itemId
    );

    if (completed && !this.video.ended) {
      this.onStatusChange("Reprise de la vidéo...");
      await this.video.play();
    }
  }

  async runHideEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);
    const previousOpacity = this.video.style.opacity;

    try {
      this.video.style.opacity = "0";
      await this.countdown(
        itemId,
        operationId,
        durationSeconds,
        item?.name ?? itemId
      );
    } finally {
      this.video.style.opacity = previousOpacity;
    }
  }

  async runMuteEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);
    const previousMuted = this.video.muted;

    try {
      this.video.muted = true;
      await this.countdown(
        itemId,
        operationId,
        durationSeconds,
        item?.name ?? itemId
      );
    } finally {
      this.video.muted = previousMuted;
    }
  }

  cancelActiveEffect() {
    if (this.activeOperation) {
      this.activeOperation.cancelled = true;
    }

    this.video.style.opacity = "";
    this.video.muted = false;
  }
}
