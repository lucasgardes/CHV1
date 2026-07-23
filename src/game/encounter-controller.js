"use strict";

import { GAME_STATUS } from "./game-state.js";
import { resolveFunscriptSelection } from "./funscript-difficulty.js";
import { registerEncounterController } from "./runtime-access.js";
import { VIDEOS } from "../data/videos.js";

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
function defaultChoice(message) { return typeof globalThis.confirm === "function" ? globalThis.confirm(message) : false; }

export class EncounterController {
  constructor({ gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript = resolveFunscriptSelection, chooseDirectorVideo = null, chooseDoubleBet = null, onEncounterLoaded = () => {}, onNormalCompleted = () => {}, onEliteCompleted = () => {}, onBossCompleted = () => {}, onPlaybackFallback = () => {} }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");
    for (const [value, name] of [[getEncounterById,"getEncounterById"],[stopVideoSync,"stopVideoSync"],[setFunscriptPath,"setFunscriptPath"],[loadFunscript,"loadFunscript"],[resetActions,"resetActions"],[resolveFunscript,"resolveFunscript"],[onEncounterLoaded,"onEncounterLoaded"],[onNormalCompleted,"onNormalCompleted"],[onEliteCompleted,"onEliteCompleted"],[onBossCompleted,"onBossCompleted"],[onPlaybackFallback,"onPlaybackFallback"]]) assertFunction(value, name);
    Object.assign(this, { gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript, onEncounterLoaded, onNormalCompleted, onEliteCompleted, onBossCompleted, onPlaybackFallback });
    this.chooseDirectorVideo = chooseDirectorVideo; this.chooseDoubleBet = chooseDoubleBet; this.currentEncounter = null; registerEncounterController(this);
  }
  getCurrentEncounter() { return this.currentEncounter; }
  resolveDirectorChoice(encounter) {
    if (!this.gameState.hasItem("director-eye")) return encounter;
    const alternatives = VIDEOS.filter((video) => video.type === encounter.type && video.id !== encounter.id);
    if (!alternatives.length) return encounter;
    const alternate = alternatives[Math.floor(Math.random() * alternatives.length)];
    const showDetails = this.gameState.isItemUpgraded("director-eye");
    const useAlternate = typeof this.chooseDirectorVideo === "function"
      ? this.chooseDirectorVideo({ current: encounter, alternate, showDetails }) === alternate.id
      : defaultChoice(`Œil du réalisateur : choisir la vidéo alternative « ${alternate.title} » ?${showDetails ? `\n\nActuelle : difficulté ${encounter.difficulty ?? "?"}\nAlternative : difficulté ${alternate.difficulty ?? "?"}` : ""}`);
    return useAlternate ? alternate : encounter;
  }
  resolveDoubleBet() {
    if (!this.gameState.hasItem("double-bet")) return { accepted:false, rewardMultiplier:1, difficultyShift:0 };
    const values = this.itemController.getEffectiveValues("double-bet") ?? {};
    const accepted = typeof this.chooseDoubleBet === "function" ? Boolean(this.chooseDoubleBet(values)) : defaultChoice("Double mise : augmenter la difficulté de cette rencontre pour doubler sa récompense ?");
    return { accepted, rewardMultiplier: accepted ? (Number(values.rewardMultiplier) || 2) : 1, difficultyShift: accepted ? 1 : 0 };
  }
  getMetronomeMultiplier() {
    if (!this.gameState.hasItem("metronome")) return 1;
    const state = this.gameState.itemRunState;
    if (state.rescueUsedInEncounter) { state.metronomeStreak = 0; return 1; }
    state.metronomeStreak += 1;
    const values = this.itemController.getEffectiveValues("metronome") ?? {};
    return 1 + Math.min(Number(values.max) || 0, state.metronomeStreak * (Number(values.step) || 0));
  }
  async load(encounterId) {
    let encounter = this.getEncounterById(encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterId}`);
    encounter = this.resolveDirectorChoice(encounter); await this.stopVideoSync();
    const eventModifiers = this.gameState.consumeEncounterModifiers?.() ?? [];
    const modifierSummary = aggregateModifiers(eventModifiers); const doubleBet = this.resolveDoubleBet();
    const totalDifficultyShift = modifierSummary.intensityShift + doubleBet.difficultyShift;
    if (Number.isInteger(totalDifficultyShift) && totalDifficultyShift !== 0) this.gameState.queueNextFunscriptDifficultyShift(totalDifficultyShift);
    const funscriptSelection = this.resolveFunscript({ encounter, gameState: this.gameState });
    const baseRewardGold = Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0;
    const loadedEncounter = { ...encounter, selectedFunscriptDifficulty:funscriptSelection.difficulty, requestedFunscriptDifficulty:funscriptSelection.requestedDifficulty, selectedFunscriptPath:funscriptSelection.path, funscriptFallbackUsed:funscriptSelection.fallbackUsed, eventModifiers, doubleBetAccepted:doubleBet.accepted, durationAdjustmentSeconds:modifierSummary.durationSeconds, hideInterfaceSeconds:modifierSummary.hideInterfaceSeconds, effectiveRewardGold:Math.max(0,Math.round((baseRewardGold+modifierSummary.rewardGoldFlat)*modifierSummary.rewardMultiplier*doubleBet.rewardMultiplier)) };
    this.currentEncounter = loadedEncounter; this.gameState.itemRunState.rescueUsedInEncounter = false;
    this.resetActions(); this.video.pause(); this.video.src = encounter.videoPath; this.video.load(); this.setFunscriptPath(funscriptSelection.path); await this.loadFunscript(); this.itemController.resetForEncounter(); this.onEncounterLoaded(loadedEncounter, funscriptSelection);
    try { await this.video.play(); } catch (error) { this.onPlaybackFallback(loadedEncounter, error); }
    return loadedEncounter;
  }
  async complete() {
    const encounterState = this.gameState.currentEncounter;
    if (encounterState === null) { console.warn("Aucune rencontre active à terminer."); return null; }
    const encounter = this.currentEncounter ?? this.getEncounterById(encounterState.encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterState.encounterId}`);
    let rewardGold = Number.isFinite(encounter.effectiveRewardGold) ? encounter.effectiveRewardGold : (Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0);
    rewardGold = Math.max(0, Math.round(rewardGold * this.getMetronomeMultiplier()));
    this.gameState.completeCurrentNode(); this.currentEncounter = null;
    const rechargeResult = this.itemController.advanceRechargeCounters({ encounterType: encounter.type }); this.gameState.advanceDisabledItems?.();
    if (encounter.type === "boss") { this.gameState.setCurrentEncounter(null); this.gameState.setStatus(GAME_STATUS.VICTORY); this.onBossCompleted({ encounter, rewardGold, rechargeResult, gameState:this.gameState }); return { type:"boss", encounter, rewardGold, rechargeResult }; }
    if (encounter.type === "elite") {
      this.gameState.setRunFlag("pending-elite-reward-context", { encounter:{ ...encounter }, rewardGold, doubleBetAccepted:encounter.doubleBetAccepted === true });
      this.gameState.setStatus(GAME_STATUS.REWARD); this.onEliteCompleted({ encounter, rewardGold, rechargeResult, gameState:this.gameState }); return { type:"elite", encounter, rewardGold, rechargeResult };
    }
    this.gameState.addGold(rewardGold); this.gameState.setCurrentEncounter(null); this.gameState.setStatus(GAME_STATUS.MAP); this.onNormalCompleted({ encounter, rewardGold, rechargeResult, gameState:this.gameState }); return { type:"normal", encounter, rewardGold, rechargeResult };
  }
}