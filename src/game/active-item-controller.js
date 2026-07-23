"use strict";

import { getItemById, ITEM_TYPES, RECHARGE_TYPES } from "../data/items.js";
import { getGameRuntime } from "./runtime-access.js";

const SUPPORTED_EFFECTS = new Set([
  "pause-video", "hide-video", "mute-video", "skip-video-seconds", "abort-encounter",
  "arm-next-encounter-protection", "skip-normal-node", "open-shortcut", "split-encounter",
  "leave-current-room", "intensity-multiplier", "mirror-intensity"
]);
const RESCUE_EFFECTS = new Set(["abort-encounter", "arm-next-encounter-protection", "open-shortcut", "leave-current-room"]);

function defaultWait(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }

export class ActiveItemController {
  constructor({ gameState, itemController, video, wait = defaultWait, onStateChange = () => {}, onStatusChange = () => {} }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");
    if (typeof wait !== "function") throw new TypeError("wait doit être une fonction.");
    Object.assign(this, { gameState, itemController, video, wait, onStateChange, onStatusChange });
    this.activeOperation = null;
    this.operationId = 0;
  }

  state() {
    if (!this.gameState.itemRunState) this.gameState.itemRunState = {};
    return this.gameState.itemRunState;
  }

  isBusy() { return this.activeOperation !== null; }
  supportsItem(itemId) { return SUPPORTED_EFFECTS.has(getItemById(itemId)?.effect?.type); }

  getActiveCapacity() {
    const extra = this.gameState.hasItem("utility-belt") ? Math.max(0, Number(this.itemController.getEffectiveValues("utility-belt")?.slots) || 0) : 0;
    return 3 + extra;
  }

  getEquippedActiveItemIds() {
    const activeItems = this.gameState.inventory.filter((itemId) => {
      const item = getItemById(itemId);
      return item && [ITEM_TYPES.CONSUMABLE, ITEM_TYPES.RECHARGEABLE].includes(item.type);
    });
    return activeItems.slice(0, this.getActiveCapacity());
  }

  isEquipped(itemId) { return this.getEquippedActiveItemIds().includes(itemId); }
  canUse(itemId) { return this.supportsItem(itemId) && this.isEquipped(itemId) && this.gameState.status === "encounter" && !this.video.ended && !this.isBusy() && this.itemController.isAvailable(itemId); }

  getItemModel(itemId) {
    const item = getItemById(itemId);
    const state = this.itemController.getState(itemId);
    const recharge = this.itemController.getEffectiveRecharge(itemId);
    const upgraded = this.gameState.isItemUpgraded(itemId);
    const supported = this.supportsItem(itemId);
    let statusLabel = supported ? "disponible" : "mécanique en attente";
    if (!this.isEquipped(itemId)) statusLabel = `hors ceinture (${this.getActiveCapacity()} emplacements)`;
    else if (state.encounterLocked) statusLabel = "bloqué pendant cette rencontre";
    else if (state.active) statusLabel = "actif";
    else if (!state.available && recharge?.type === RECHARGE_TYPES.ELITE) statusLabel = "recharge après un élite";
    else if (!state.available && recharge?.type === RECHARGE_TYPES.ONCE_PER_RUN) statusLabel = "déjà utilisé cette partie";
    else if (!state.available) statusLabel = `recharge dans ${state.remainingRechargeRounds} rencontre${state.remainingRechargeRounds > 1 ? "s" : ""}`;
    return { id:itemId, name:`${item?.name ?? itemId}${upgraded ? " +" : ""}`, upgraded, available:state.available, active:state.active, remainingRechargeRounds:state.remainingRechargeRounds, statusLabel, disabled:!this.canUse(itemId), title:supported ? (item?.description ?? "") : "Cet effet dépend d’une mécanique encore en cours d’intégration." };
  }

  shouldUseFreeDoubleCommand(itemId) {
    const state = this.state();
    if (!this.gameState.hasItem("double-command") || state.doubleCommandUsed) return false;
    const pending = state.doubleCommandPendingItemId;
    if (!pending) return false;
    const consecutive = this.itemController.getEffectiveValues("double-command")?.mustBeConsecutive !== false;
    return pending === itemId && (consecutive || state.doubleCommandPendingItemId === itemId);
  }

  armDoubleCommand(itemId) {
    const state = this.state();
    if (!this.gameState.hasItem("double-command") || state.doubleCommandUsed || state.doubleCommandPendingItemId) return;
    state.doubleCommandPendingItemId = itemId;
  }

  clearNonConsecutiveDoubleCommand(itemId) {
    const state = this.state();
    if (!state.doubleCommandPendingItemId || state.doubleCommandPendingItemId === itemId) return;
    if (this.itemController.getEffectiveValues("double-command")?.mustBeConsecutive !== false) state.doubleCommandPendingItemId = null;
  }

  markRescueUse(item) {
    if (!RESCUE_EFFECTS.has(item.effect.type)) return;
    const state = this.state();
    state.rescueUsedInEncounter = true;
    state.metronomeStreak = 0;
  }

  async use(itemId) {
    if (!this.canUse(itemId)) throw new Error(`L’objet ${itemId} ne peut pas être utilisé maintenant.`);
    const item = getItemById(itemId);
    const currentOperationId = ++this.operationId;
    const freeRepeat = this.shouldUseFreeDoubleCommand(itemId);
    this.clearNonConsecutiveDoubleCommand(itemId);
    this.activeOperation = { id:currentOperationId, itemId, cancelled:false, previousOpacity:this.video.style.opacity, previousMuted:this.video.muted, previousPlaybackRate:this.video.playbackRate };
    this.itemController.activate(itemId);
    if (!freeRepeat) this.itemController.consumeCharge(itemId);
    else {
      const state = this.state();
      state.doubleCommandUsed = true;
      state.doubleCommandPendingItemId = null;
      this.onStatusChange("Double commande : seconde utilisation gratuite.");
    }
    this.markRescueUse(item);
    this.onStateChange();
    try {
      switch (item.effect.type) {
        case "pause-video": await this.runPauseEffect(itemId, currentOperationId); break;
        case "hide-video": await this.runHideEffect(itemId, currentOperationId); break;
        case "mute-video": await this.runMuteEffect(itemId, currentOperationId); break;
        case "skip-video-seconds": this.runSkipEffect(itemId); break;
        case "abort-encounter": await this.requireRunController().abortEncounterWithEmergencyButton(itemId); break;
        case "arm-next-encounter-protection": this.requireRunController().armDelayedProtection(itemId); break;
        case "skip-normal-node": this.requireRunController().shortenCurrentEncounter(itemId); break;
        case "open-shortcut": await this.requireRunController().skipNormalEncounter(itemId); break;
        case "split-encounter": await this.runFragmentation(itemId, currentOperationId); break;
        case "leave-current-room": await this.requireRunController().leaveCurrentRoom(itemId); break;
        case "intensity-multiplier": await this.runIntensityRelief(itemId, currentOperationId); break;
        case "mirror-intensity": this.runMirrorEffect(itemId); break;
        default: throw new Error(`Effet actif inconnu : ${item.effect.type}`);
      }
      if (!freeRepeat) this.armDoubleCommand(itemId);
    } finally {
      this.restoreVideoState(currentOperationId);
      this.itemController.finishActivation(itemId);
      if (this.activeOperation?.id === currentOperationId) this.activeOperation = null;
      this.onStateChange();
    }
  }

  requireRunController() { const controller = getGameRuntime().runController; if (!controller) throw new Error("Le contrôleur de partie n’est pas prêt."); return controller; }
  async countdown(operationId, durationSeconds, label) {
    for (let remaining = durationSeconds; remaining > 0; remaining -= 1) {
      if (!this.isOperationValid(operationId)) return false;
      this.onStatusChange(`${label} actif : ${remaining} seconde${remaining > 1 ? "s" : ""}.`);
      await this.wait(1000);
    }
    return this.isOperationValid(operationId);
  }
  isOperationValid(operationId) { return this.activeOperation?.id === operationId && this.activeOperation.cancelled === false && this.gameState.status === "encounter"; }
  async runPauseEffect(itemId, operationId) { const duration=Math.max(1,Number(this.itemController.getEffectiveValues(itemId)?.durationSeconds)||1); this.video.pause(); const completed=await this.countdown(operationId,duration,getItemById(itemId)?.name??itemId); if(completed&&!this.video.ended){this.onStatusChange("Reprise de la vidéo...");await this.video.play();} }
  async runHideEffect(itemId, operationId) { const values=this.itemController.getEffectiveValues(itemId); this.video.style.opacity="0"; await this.countdown(operationId,Math.max(1,Number(values?.durationSeconds)||1),getItemById(itemId)?.name??itemId); }
  async runMuteEffect(itemId, operationId) { const values=this.itemController.getEffectiveValues(itemId); this.video.muted=true; await this.countdown(operationId,Math.max(1,Number(values?.durationSeconds)||1),getItemById(itemId)?.name??itemId); }
  runSkipEffect(itemId) { const seconds=Math.max(1,Number(this.itemController.getEffectiveValues(itemId)?.seconds)||1); const maximumTime=Number.isFinite(this.video.duration)?Math.max(0,this.video.duration-.1):this.video.currentTime+seconds; const previous=this.video.currentTime; this.video.currentTime=Math.min(maximumTime,previous+seconds); const skipped=Math.max(0,Math.round(this.video.currentTime-previous)); this.onStatusChange(`${getItemById(itemId)?.name??itemId} : ${skipped} seconde${skipped>1?"s":""} passée${skipped>1?"s":""}.`); }
  async runFragmentation(itemId, operationId) { const pauseSeconds=Math.max(1,Number(this.itemController.getEffectiveValues(itemId)?.pauseSeconds)||20); this.video.pause(); await this.countdown(operationId,pauseSeconds,"Pause de fragmentation"); if(this.isOperationValid(operationId)&&!this.video.ended) await this.video.play(); }
  async runIntensityRelief(itemId, operationId) { const values=this.itemController.getEffectiveValues(itemId); const duration=Math.max(1,Number(values?.durationSeconds)||20); this.gameState.setRunFlag?.("temporary-intensity-multiplier",Number(values?.intensityMultiplier)||.75); await this.countdown(operationId,duration,getItemById(itemId)?.name??itemId); this.gameState.setRunFlag?.("temporary-intensity-multiplier",1); }
  runMirrorEffect(itemId) { const mirrored=this.gameState.getRunFlag?.("mirror-intensity")===true; this.gameState.setRunFlag?.("mirror-intensity",!mirrored); this.onStatusChange(`Mode miroir ${!mirrored?"activé":"désactivé"}.`); }
  restoreVideoState(operationId) { const operation=this.activeOperation; if(!operation||operation.id!==operationId)return; this.video.style.opacity=operation.previousOpacity; this.video.muted=operation.previousMuted; this.video.playbackRate=operation.previousPlaybackRate; }
  cancelActiveEffect() { const operation=this.activeOperation; if(!operation)return false; operation.cancelled=true; this.restoreVideoState(operation.id); this.itemController.finishActivation(operation.itemId); this.activeOperation=null; this.gameState.setRunFlag?.("temporary-intensity-multiplier",1); this.onStateChange(); return true; }
}
