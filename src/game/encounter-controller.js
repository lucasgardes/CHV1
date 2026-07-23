"use strict";

import { GAME_STATUS } from "./game-state.js";
import { resolveFunscriptSelection } from "./funscript-difficulty.js";
import { registerEncounterController } from "./runtime-access.js";
import { ItemEffectService } from "./item-effect-service.js";

function assertFunction(value, name) { if (typeof value !== "function") throw new TypeError(`${name} doit être une fonction.`); }
function aggregateModifiers(modifiers = []) {
  return modifiers.reduce((result, modifier) => ({
    durationSeconds: result.durationSeconds + (Number(modifier.durationSeconds) || 0),
    rewardGoldFlat: result.rewardGoldFlat + (Number(modifier.rewardGoldFlat) || 0),
    rewardMultiplier: result.rewardMultiplier * (Number.isFinite(modifier.rewardMultiplier) ? modifier.rewardMultiplier : 1),
    intensityShift: result.intensityShift + (Number(modifier.intensityShift) || 0),
    hideInterfaceSeconds: Math.max(result.hideInterfaceSeconds, Number(modifier.hideInterfaceSeconds) || 0)
  }), { durationSeconds:0, rewardGoldFlat:0, rewardMultiplier:1, intensityShift:0, hideInterfaceSeconds:0 });
}

export class EncounterController {
  constructor({ gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript = resolveFunscriptSelection, onEncounterLoaded = () => {}, onNormalCompleted = () => {}, onEliteCompleted = () => {}, onBossCompleted = () => {}, onPlaybackFallback = () => {}, random = Math.random }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");
    for (const [value, name] of [[getEncounterById,"getEncounterById"],[stopVideoSync,"stopVideoSync"],[setFunscriptPath,"setFunscriptPath"],[loadFunscript,"loadFunscript"],[resetActions,"resetActions"],[resolveFunscript,"resolveFunscript"],[onEncounterLoaded,"onEncounterLoaded"],[onNormalCompleted,"onNormalCompleted"],[onEliteCompleted,"onEliteCompleted"],[onBossCompleted,"onBossCompleted"],[onPlaybackFallback,"onPlaybackFallback"]]) assertFunction(value, name);
    Object.assign(this, { gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript, onEncounterLoaded, onNormalCompleted, onEliteCompleted, onBossCompleted, onPlaybackFallback });
    this.itemEffects = new ItemEffectService({ gameState, itemController, random });
    this.currentEncounter = null;
    registerEncounterController(this);
  }

  getCurrentEncounter() { return this.currentEncounter; }

  async load(encounterId) {
    const encounter = this.getEncounterById(encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterId}`);
    await this.stopVideoSync();
    const eventModifiers = this.gameState.consumeEncounterModifiers?.() ?? [];
    const eventSummary = aggregateModifiers(eventModifiers);
    const itemSummary = this.itemEffects.getEncounterModifiers(encounter);
    if (Number.isInteger(eventSummary.intensityShift) && eventSummary.intensityShift !== 0) this.gameState.queueNextFunscriptDifficultyShift(eventSummary.intensityShift);
    const funscriptSelection = this.resolveFunscript({ encounter, gameState: this.gameState });
    const baseRewardGold = Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0;
    const rewardMultiplier = eventSummary.rewardMultiplier * itemSummary.rewardMultiplier;
    const durationReductionSeconds = Math.max(0, itemSummary.durationReductionSeconds - itemSummary.durationExtraSeconds - eventSummary.durationSeconds);
    const loadedEncounter = {
      ...encounter,
      selectedFunscriptDifficulty: funscriptSelection.difficulty,
      requestedFunscriptDifficulty: funscriptSelection.requestedDifficulty,
      selectedFunscriptPath: funscriptSelection.path,
      funscriptFallbackUsed: funscriptSelection.fallbackUsed,
      eventModifiers,
      itemModifiers: itemSummary,
      durationAdjustmentSeconds: eventSummary.durationSeconds + itemSummary.durationExtraSeconds - itemSummary.durationReductionSeconds,
      hideInterfaceSeconds: eventSummary.hideInterfaceSeconds,
      activeItemsDisabled: itemSummary.activeItemsDisabled,
      intensityMultiplier: itemSummary.intensityMultiplier,
      effectiveRewardGold: Math.max(0, Math.round((baseRewardGold + eventSummary.rewardGoldFlat + itemSummary.possessedBatteryGoldBonus) * rewardMultiplier))
    };
    this.currentEncounter = loadedEncounter;
    this.resetActions();
    this.video.pause();
    this.video.src = encounter.videoPath;
    this.video.load();
    this.setFunscriptPath(funscriptSelection.path);
    await this.loadFunscript();
    this.itemController.resetForEncounter();
    if (itemSummary.activeItemsDisabled) this.itemController.setEncounterLock?.(true);
    else this.itemController.setEncounterLock?.(false);
    if (durationReductionSeconds > 0) {
      const applyReduction = () => {
        if (Number.isFinite(this.video.duration)) this.video.currentTime = Math.min(durationReductionSeconds, Math.max(0, this.video.duration - 0.1));
      };
      if (this.video.readyState >= 1) applyReduction();
      else this.video.addEventListener("loadedmetadata", applyReduction, { once:true });
    }
    this.onEncounterLoaded(loadedEncounter, funscriptSelection);
    try { await this.video.play(); } catch (error) { this.onPlaybackFallback(loadedEncounter, error); }
    return loadedEncounter;
  }

  async complete() {
    const encounterState = this.gameState.currentEncounter;
    if (encounterState === null) { console.warn("Aucune rencontre active à terminer."); return null; }
    const encounter = this.getEncounterById(encounterState.encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterState.encounterId}`);
    const rewardGold = Number.isFinite(this.currentEncounter?.effectiveRewardGold) ? this.currentEncounter.effectiveRewardGold : (Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0);
    this.gameState.completeCurrentNode();
    this.currentEncounter = null;
    this.itemController.setEncounterLock?.(false);
    const rechargeResult = this.itemController.advanceRechargeCounters({ encounterType: encounter.type });
    this.gameState.advanceDisabledItems?.();
    if (encounter.type === "boss") {
      this.gameState.setCurrentEncounter(null); this.gameState.setStatus(GAME_STATUS.VICTORY);
      this.onBossCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
      return { type:"boss", encounter, rewardGold, rechargeResult };
    }
    if (encounter.type === "elite") {
      this.gameState.setStatus(GAME_STATUS.REWARD);
      this.onEliteCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
      return { type:"elite", encounter, rewardGold, rechargeResult };
    }
    this.gameState.addGold(rewardGold);
    this.gameState.setCurrentEncounter(null); this.gameState.setStatus(GAME_STATUS.MAP);
    this.onNormalCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
    return { type:"normal", encounter, rewardGold, rechargeResult };
  }
}
