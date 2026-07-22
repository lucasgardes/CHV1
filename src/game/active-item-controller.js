"use strict";

import { getItemById, RECHARGE_TYPES } from "../data/items.js";

const SUPPORTED_EFFECTS = new Set([
  "pause-video",
  "hide-video",
  "mute-video",
  "skip-video-seconds"
]);

function defaultWait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class ActiveItemController {
  constructor({
    gameState,
    itemController,
    video,
    wait = defaultWait,
    onStateChange = () => {},
    onStatusChange = () => {}
  }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");
    if (typeof wait !== "function") throw new TypeError("wait doit être une fonction.");
    if (typeof onStateChange !== "function") throw new TypeError("onStateChange doit être une fonction.");
    if (typeof onStatusChange !== "function") throw new TypeError("onStatusChange doit être une fonction.");

    this.gameState = gameState;
    this.itemController = itemController;
    this.video = video;
    this.wait = wait;
    this.onStateChange = onStateChange;
    this.onStatusChange = onStatusChange;
    this.activeOperation = null;
    this.operationId = 0;
  }

  isBusy() { return this.activeOperation !== null; }
  supportsItem(itemId) { return SUPPORTED_EFFECTS.has(getItemById(itemId)?.effect?.type); }

  canUse(itemId) {
    return this.supportsItem(itemId) &&
      this.gameState.status === "encounter" &&
      !this.video.paused &&
      !this.video.ended &&
      !this.isBusy() &&
      this.itemController.isAvailable(itemId);
  }

  getItemModel(itemId) {
    const item = getItemById(itemId);
    const state = this.itemController.getState(itemId);
    const recharge = this.itemController.getEffectiveRecharge(itemId);
    const upgraded = this.gameState.isItemUpgraded(itemId);
    const supported = this.supportsItem(itemId);

    let statusLabel = supported ? "disponible" : "mécanique en attente";
    if (state.active) statusLabel = "actif";
    else if (!state.available && recharge?.type === RECHARGE_TYPES.ELITE) statusLabel = "recharge après un élite";
    else if (!state.available && recharge?.type === RECHARGE_TYPES.ONCE_PER_RUN) statusLabel = "déjà utilisé cette partie";
    else if (!state.available) {
      const rounds = state.remainingRechargeRounds;
      statusLabel = `recharge dans ${rounds} rencontre${rounds > 1 ? "s" : ""}`;
    }

    return {
      id: itemId,
      name: `${item?.name ?? itemId}${upgraded ? " +" : ""}`,
      upgraded,
      available: state.available,
      active: state.active,
      remainingRechargeRounds: state.remainingRechargeRounds,
      statusLabel,
      disabled: !this.canUse(itemId),
      title: supported ? (item?.description ?? "") : "Cet effet dépend d’une mécanique encore en cours d’intégration."
    };
  }

  async use(itemId) {
    if (!this.canUse(itemId)) throw new Error(`L’objet ${itemId} ne peut pas être utilisé maintenant.`);

    const item = getItemById(itemId);
    const currentOperationId = ++this.operationId;
    this.activeOperation = {
      id: currentOperationId,
      itemId,
      cancelled: false,
      previousOpacity: this.video.style.opacity,
      previousMuted: this.video.muted
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
        case "skip-video-seconds":
          this.runSkipEffect(itemId);
          break;
        default:
          throw new Error(`Effet actif inconnu : ${item.effect.type}`);
      }
    } finally {
      this.restoreVideoState(currentOperationId);
      this.itemController.finishActivation(itemId);
      if (this.activeOperation?.id === currentOperationId) this.activeOperation = null;
      this.onStateChange();
    }
  }

  async countdown(operationId, durationSeconds, label) {
    for (let remaining = durationSeconds; remaining > 0; remaining -= 1) {
      if (!this.isOperationValid(operationId)) return false;
      this.onStatusChange(`${label} actif : ${remaining} seconde${remaining > 1 ? "s" : ""}.`);
      await this.wait(1000);
    }
    return this.isOperationValid(operationId);
  }

  isOperationValid(operationId) {
    return this.activeOperation?.id === operationId &&
      this.activeOperation.cancelled === false &&
      this.gameState.status === "encounter";
  }

  async runPauseEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);
    this.video.pause();
    const completed = await this.countdown(operationId, durationSeconds, item?.name ?? itemId);
    if (completed && !this.video.ended) {
      this.onStatusChange("Reprise de la vidéo...");
      await this.video.play();
    }
  }

  async runHideEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);
    this.video.style.opacity = "0";
    await this.countdown(operationId, durationSeconds, item?.name ?? itemId);
  }

  async runMuteEffect(itemId, operationId) {
    const item = getItemById(itemId);
    const values = this.itemController.getEffectiveValues(itemId);
    const durationSeconds = Math.max(1, Number(values?.durationSeconds) || 1);
    this.video.muted = true;
    await this.countdown(operationId, durationSeconds, item?.name ?? itemId);
  }

  runSkipEffect(itemId) {
    const values = this.itemController.getEffectiveValues(itemId);
    const seconds = Math.max(1, Number(values?.seconds) || 1);
    const maximumTime = Number.isFinite(this.video.duration)
      ? Math.max(0, this.video.duration - 0.1)
      : this.video.currentTime + seconds;
    const previousTime = this.video.currentTime;
    this.video.currentTime = Math.min(maximumTime, previousTime + seconds);
    const skipped = Math.max(0, Math.round(this.video.currentTime - previousTime));
    this.onStatusChange(`${getItemById(itemId)?.name ?? itemId} : ${skipped} seconde${skipped > 1 ? "s" : ""} passée${skipped > 1 ? "s" : ""}.`);
  }

  restoreVideoState(operationId) {
    const operation = this.activeOperation;
    if (!operation || operation.id !== operationId) return;
    this.video.style.opacity = operation.previousOpacity;
    this.video.muted = operation.previousMuted;
  }

  cancelActiveEffect() {
    const operation = this.activeOperation;
    if (!operation) return false;
    operation.cancelled = true;
    this.restoreVideoState(operation.id);
    this.itemController.finishActivation(operation.itemId);
    this.activeOperation = null;
    this.onStateChange();
    return true;
  }
}
