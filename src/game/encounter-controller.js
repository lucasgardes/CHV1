"use strict";

import { GAME_STATUS } from "./game-state.js";
import { resolveFunscriptSelection } from "./funscript-difficulty.js";
import { registerEncounterController } from "./runtime-access.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} doit être une fonction.`);
}

export class EncounterController {
  constructor({
    gameState,
    itemController,
    video,
    getEncounterById,
    stopVideoSync,
    setFunscriptPath,
    loadFunscript,
    resetActions,
    resolveFunscript = resolveFunscriptSelection,
    onEncounterLoaded = () => {},
    onNormalCompleted = () => {},
    onEliteCompleted = () => {},
    onBossCompleted = () => {},
    onPlaybackFallback = () => {}
  }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");

    assertFunction(getEncounterById, "getEncounterById");
    assertFunction(stopVideoSync, "stopVideoSync");
    assertFunction(setFunscriptPath, "setFunscriptPath");
    assertFunction(loadFunscript, "loadFunscript");
    assertFunction(resetActions, "resetActions");
    assertFunction(resolveFunscript, "resolveFunscript");
    assertFunction(onEncounterLoaded, "onEncounterLoaded");
    assertFunction(onNormalCompleted, "onNormalCompleted");
    assertFunction(onEliteCompleted, "onEliteCompleted");
    assertFunction(onBossCompleted, "onBossCompleted");
    assertFunction(onPlaybackFallback, "onPlaybackFallback");

    this.gameState = gameState;
    this.itemController = itemController;
    this.video = video;
    this.getEncounterById = getEncounterById;
    this.stopVideoSync = stopVideoSync;
    this.setFunscriptPath = setFunscriptPath;
    this.loadFunscript = loadFunscript;
    this.resetActions = resetActions;
    this.resolveFunscript = resolveFunscript;
    this.onEncounterLoaded = onEncounterLoaded;
    this.onNormalCompleted = onNormalCompleted;
    this.onEliteCompleted = onEliteCompleted;
    this.onBossCompleted = onBossCompleted;
    this.onPlaybackFallback = onPlaybackFallback;
    this.currentEncounter = null;
    registerEncounterController(this);
  }

  getCurrentEncounter() { return this.currentEncounter; }

  async load(encounterId) {
    const encounter = this.getEncounterById(encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterId}`);

    await this.stopVideoSync();
    const funscriptSelection = this.resolveFunscript({ encounter, gameState: this.gameState });
    const loadedEncounter = {
      ...encounter,
      selectedFunscriptDifficulty: funscriptSelection.difficulty,
      requestedFunscriptDifficulty: funscriptSelection.requestedDifficulty,
      selectedFunscriptPath: funscriptSelection.path,
      funscriptFallbackUsed: funscriptSelection.fallbackUsed
    };

    this.currentEncounter = loadedEncounter;
    this.resetActions();
    this.video.pause();
    this.video.src = encounter.videoPath;
    this.video.load();
    this.setFunscriptPath(funscriptSelection.path);
    await this.loadFunscript();
    this.itemController.resetForEncounter();
    this.onEncounterLoaded(loadedEncounter, funscriptSelection);

    try { await this.video.play(); }
    catch (error) { this.onPlaybackFallback(loadedEncounter, error); }

    return loadedEncounter;
  }

  async complete() {
    const encounterState = this.gameState.currentEncounter;
    if (encounterState === null) {
      console.warn("Aucune rencontre active à terminer.");
      return null;
    }

    const encounter = this.getEncounterById(encounterState.encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterState.encounterId}`);

    const rewardGold = Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0;
    this.gameState.completeCurrentNode();
    this.currentEncounter = null;

    const rechargeResult = this.itemController.advanceRechargeCounters({ encounterType: encounter.type });

    if (encounter.type === "boss") {
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.VICTORY);
      this.onBossCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
      return { type: "boss", encounter, rewardGold, rechargeResult };
    }

    if (encounter.type === "elite") {
      this.gameState.setStatus(GAME_STATUS.REWARD);
      this.onEliteCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
      return { type: "elite", encounter, rewardGold, rechargeResult };
    }

    this.gameState.addGold(rewardGold);
    this.gameState.setCurrentEncounter(null);
    this.gameState.setStatus(GAME_STATUS.MAP);
    this.onNormalCompleted({ encounter, rewardGold, rechargeResult, gameState: this.gameState });
    return { type: "normal", encounter, rewardGold, rechargeResult };
  }
}
