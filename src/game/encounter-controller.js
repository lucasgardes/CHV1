"use strict";

import { GAME_STATUS } from "./game-state.js";
import { resolveFunscriptSelection } from "./funscript-difficulty.js";
import { registerEncounterController } from "./runtime-access.js";
import { VIDEOS } from "../data/videos.js";

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} doit être une fonction.`);
}

function aggregateModifiers(modifiers = []) {
  return modifiers.reduce((result, modifier) => ({
    durationSeconds: result.durationSeconds + (Number(modifier.durationSeconds) || 0),
    rewardGoldFlat: result.rewardGoldFlat + (Number(modifier.rewardGoldFlat) || 0),
    rewardMultiplier: result.rewardMultiplier * (Number.isFinite(modifier.rewardMultiplier) ? modifier.rewardMultiplier : 1),
    intensityShift: result.intensityShift + (Number(modifier.intensityShift) || 0),
    hideInterfaceSeconds: Math.max(result.hideInterfaceSeconds, Number(modifier.hideInterfaceSeconds) || 0)
  }), {
    durationSeconds: 0,
    rewardGoldFlat: 0,
    rewardMultiplier: 1,
    intensityShift: 0,
    hideInterfaceSeconds: 0
  });
}

function ensureChoiceDialogStyles() {
  if (document.querySelector('link[data-item-choice-dialog="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./item-choice-dialog.css";
  link.dataset.itemChoiceDialog = "true";
  document.head.append(link);
}

function defaultChoice({ title, message, details = "", icon = "◆", declineLabel = "Ne pas activer", activateLabel = "Activer" }) {
  if (typeof document === "undefined" || !document.body) {
    return Promise.resolve(typeof globalThis.confirm === "function" ? globalThis.confirm(message) : false);
  }

  ensureChoiceDialogStyles();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "item-choice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title);

    const dialog = document.createElement("section");
    dialog.className = "item-choice-dialog";
    dialog.innerHTML = `
      <header class="item-choice-dialog__header">
        <span class="item-choice-dialog__icon" aria-hidden="true"></span>
        <div>
          <p class="item-choice-dialog__eyebrow">Activation d’objet</p>
          <h2></h2>
        </div>
      </header>
      <div class="item-choice-dialog__body">
        <p class="item-choice-dialog__message"></p>
        <p class="item-choice-dialog__details" hidden></p>
      </div>
      <div class="item-choice-dialog__actions">
        <button class="item-choice-dialog__decline" type="button"></button>
        <button class="item-choice-dialog__activate" type="button"></button>
      </div>
    `;

    dialog.querySelector(".item-choice-dialog__icon").textContent = icon;
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector(".item-choice-dialog__message").textContent = message;
    dialog.querySelector(".item-choice-dialog__decline").textContent = declineLabel;
    dialog.querySelector(".item-choice-dialog__activate").textContent = activateLabel;
    const detailsElement = dialog.querySelector(".item-choice-dialog__details");
    if (details) {
      detailsElement.textContent = details;
      detailsElement.hidden = false;
    }

    const finish = (accepted) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(accepted);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
    };

    dialog.querySelector(".item-choice-dialog__activate").addEventListener("click", () => finish(true));
    dialog.querySelector(".item-choice-dialog__decline").addEventListener("click", () => finish(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKeyDown);
    overlay.append(dialog);
    document.body.append(overlay);
    dialog.querySelector(".item-choice-dialog__activate").focus();
  });
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (!value) return "Durée inconnue";
  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function difficultyLabel(value) {
  return ({ warmup:"Échauffement", easy:"Facile", normal:"Normale", medium:"Moyenne", hard:"Difficile", boss:"Boss" })[value] ?? value ?? "Inconnue";
}

function encounterDifficulty(encounter) {
  return encounter?.selectedDifficulty ?? encounter?.requestedDifficulty ?? encounter?.difficulty ?? encounter?.defaultFunscriptDifficulty ?? "normal";
}

function blessingDuration(gameState, type) {
  if (gameState.activeBlessingId === "breath-of-mercy") {
    if (type === "normal") return -10;
    if (type === "elite") return -15;
  }
  if (gameState.activeBlessingId === "temporal-debt") {
    if (type === "normal") return -15;
    if (type === "boss") return 45;
  }
  return 0;
}

export class EncounterController {
  constructor({ gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript = resolveFunscriptSelection, chooseDirectorVideo = null, chooseDoubleBet = null, onEncounterLoaded = () => {}, onNormalCompleted = () => {}, onEliteCompleted = () => {}, onBossCompleted = () => {}, onPlaybackFallback = () => {} }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    if (!itemController) throw new Error("Le contrôleur d’objets est requis.");
    if (!(video instanceof HTMLVideoElement)) throw new Error("Le lecteur vidéo est invalide.");
    for (const [value, name] of [[getEncounterById, "getEncounterById"], [stopVideoSync, "stopVideoSync"], [setFunscriptPath, "setFunscriptPath"], [loadFunscript, "loadFunscript"], [resetActions, "resetActions"], [resolveFunscript, "resolveFunscript"], [onEncounterLoaded, "onEncounterLoaded"], [onNormalCompleted, "onNormalCompleted"], [onEliteCompleted, "onEliteCompleted"], [onBossCompleted, "onBossCompleted"], [onPlaybackFallback, "onPlaybackFallback"]]) assertFunction(value, name);
    Object.assign(this, { gameState, itemController, video, getEncounterById, stopVideoSync, setFunscriptPath, loadFunscript, resetActions, resolveFunscript, onEncounterLoaded, onNormalCompleted, onEliteCompleted, onBossCompleted, onPlaybackFallback });
    this.chooseDirectorVideo = chooseDirectorVideo;
    this.chooseDoubleBet = chooseDoubleBet;
    this.getDirectorAlternative = null;
    this.currentEncounter = null;
    registerEncounterController(this);
  }

  getCurrentEncounter() { return this.currentEncounter; }

  async resolveDirectorChoice(encounter) {
    if (!this.gameState.hasItem("director-eye")) return encounter;
    let alternate = typeof this.getDirectorAlternative === "function"
      ? await this.getDirectorAlternative(encounter)
      : null;
    if (!alternate) {
      const alternatives = VIDEOS.filter((video) => video.type === encounter.type && video.id !== encounter.id);
      alternate = alternatives[Math.floor(Math.random() * alternatives.length)] ?? null;
    }
    if (!alternate) return encounter;

    const showDetails = this.gameState.isItemUpgraded("director-eye");
    const details = showDetails
      ? `${encounter.title}\nDurée : ${formatDuration(encounter.durationSeconds)}\nDifficulté : ${difficultyLabel(encounterDifficulty(encounter))}\n\n${alternate.title}\nDurée : ${formatDuration(alternate.durationSeconds)}\nDifficulté : ${difficultyLabel(encounterDifficulty(alternate))}`
      : `${encounter.title}\n\n${alternate.title}`;
    const useAlternate = typeof this.chooseDirectorVideo === "function"
      ? (await this.chooseDirectorVideo({ current: encounter, alternate, showDetails })) === alternate.id
      : await defaultChoice({
          title: "Œil du réalisateur",
          message: "Choisis la vidéo de cette rencontre.",
          details,
          icon: "◉",
          declineLabel:encounter.title,
          activateLabel:alternate.title
        });
    return useAlternate ? alternate : encounter;
  }

  markEncounterAsPlayed(encounter) {
    const state = this.gameState.itemRunState;
    if (!state) return;
    if (!Array.isArray(state.playedMediaIds)) state.playedMediaIds = [];
    const mediaId = encounter?.mediaId ?? (String(encounter?.id ?? "").startsWith("local:") ? String(encounter.id).slice(6) : encounter?.id);
    if (mediaId && !state.playedMediaIds.includes(mediaId)) state.playedMediaIds.push(mediaId);
  }

  async resolveDoubleBet() {
    if (!this.gameState.hasItem("double-bet")) return { accepted: false, rewardMultiplier: 1, difficultyShift: 0 };
    const values = this.itemController.getEffectiveValues("double-bet") ?? {};
    const accepted = typeof this.chooseDoubleBet === "function"
      ? Boolean(await this.chooseDoubleBet(values))
      : await defaultChoice({
          title: "Double mise",
          message: "Augmenter la difficulté de cette rencontre pour doubler sa récompense ?",
          details: "Effet : difficulté augmentée de 1 niveau\nRécompense : ×2",
          icon: "×2"
        });
    return {
      accepted,
      rewardMultiplier: accepted ? (Number(values.rewardMultiplier) || 2) : 1,
      difficultyShift: accepted ? 1 : 0
    };
  }

  getMetronomeMultiplier() {
    if (!this.gameState.hasItem("metronome")) return 1;
    const state = this.gameState.itemRunState;
    if (state.rescueUsedInEncounter) { state.metronomeStreak = 0; return 1; }
    state.metronomeStreak += 1;
    const values = this.itemController.getEffectiveValues("metronome") ?? {};
    return 1 + Math.min(Number(values.max) || 0, state.metronomeStreak * (Number(values.step) || 0));
  }

  reduceRechargeAfterElite() {
    if (this.gameState.activeBlessingId !== "second-wind") return [];
    const changed = [];
    for (const itemId of this.gameState.inventory) {
      const state = this.itemController.ensureRuntimeState(itemId);
      if (state.available || state.remainingRechargeRounds <= 0) continue;
      state.remainingRechargeRounds = Math.max(0, state.remainingRechargeRounds - 1);
      if (state.remainingRechargeRounds === 0) this.itemController.recharge(itemId);
      changed.push(itemId);
    }
    return changed;
  }

  async load(encounterId) {
    let encounter = this.getEncounterById(encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterId}`);
    encounter = await this.resolveDirectorChoice(encounter);
    this.markEncounterAsPlayed(encounter);
    await this.stopVideoSync();
    const eventModifiers = this.gameState.consumeEncounterModifiers?.() ?? [];
    const modifierSummary = aggregateModifiers(eventModifiers);
    const doubleBet = await this.resolveDoubleBet();
    const totalDifficultyShift = modifierSummary.intensityShift + doubleBet.difficultyShift;
    if (Number.isInteger(totalDifficultyShift) && totalDifficultyShift !== 0) this.gameState.queueNextFunscriptDifficultyShift(totalDifficultyShift);
    const funscriptSelection = this.resolveFunscript({ encounter, gameState: this.gameState });
    const baseRewardGold = Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0;
    const blessingAdjustment = blessingDuration(this.gameState, encounter.type);
    const loadedEncounter = {
      ...encounter,
      selectedFunscriptDifficulty: funscriptSelection.difficulty,
      requestedFunscriptDifficulty: funscriptSelection.requestedDifficulty,
      selectedFunscriptPath: funscriptSelection.path,
      funscriptFallbackUsed: funscriptSelection.fallbackUsed,
      eventModifiers,
      doubleBetAccepted: doubleBet.accepted,
      durationAdjustmentSeconds: modifierSummary.durationSeconds + blessingAdjustment,
      blessingDurationAdjustmentSeconds: blessingAdjustment,
      hideInterfaceSeconds: modifierSummary.hideInterfaceSeconds,
      effectiveRewardGold: Math.max(0, Math.round((baseRewardGold + modifierSummary.rewardGoldFlat) * modifierSummary.rewardMultiplier * doubleBet.rewardMultiplier))
    };
    this.currentEncounter = loadedEncounter;
    this.gameState.itemRunState.rescueUsedInEncounter = false;
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
    if (encounterState === null) { console.warn("Aucune rencontre active à terminer."); return null; }
    const encounter = this.currentEncounter ?? this.getEncounterById(encounterState.encounterId);
    if (encounter === null) throw new Error(`Rencontre introuvable : ${encounterState.encounterId}`);
    let rewardGold = Number.isFinite(encounter.effectiveRewardGold) ? encounter.effectiveRewardGold : (Number.isFinite(encounter.rewardGold) ? encounter.rewardGold : 0);
    rewardGold = Math.max(0, Math.round(rewardGold * this.getMetronomeMultiplier()));
    this.gameState.completeCurrentNode();
    this.currentEncounter = null;
    const rechargeResult = this.itemController.advanceRechargeCounters({ encounterType: encounter.type });
    this.gameState.advanceDisabledItems?.();
    const deferredRewards = this.gameState.advanceDeferredEncounterRewards?.() ?? [];
    if (encounter.type === "boss") {
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.VICTORY);
      this.onBossCompleted({ encounter, rewardGold, rechargeResult, deferredRewards, gameState: this.gameState });
      return { type: "boss", encounter, rewardGold, rechargeResult, deferredRewards };
    }
    if (encounter.type === "elite") {
      const blessingRechargeIds = this.reduceRechargeAfterElite();
      this.gameState.setRunFlag("pending-elite-reward-context", { encounter: { ...encounter }, rewardGold, doubleBetAccepted: encounter.doubleBetAccepted === true });
      this.gameState.setStatus(GAME_STATUS.REWARD);
      this.onEliteCompleted({ encounter, rewardGold, rechargeResult: { ...rechargeResult, blessingRechargeIds }, deferredRewards, gameState: this.gameState });
      return { type: "elite", encounter, rewardGold, rechargeResult, deferredRewards };
    }
    this.gameState.addGold(rewardGold);
    this.gameState.setCurrentEncounter(null);
    this.gameState.setStatus(GAME_STATUS.MAP);
    this.onNormalCompleted({ encounter, rewardGold, rechargeResult, deferredRewards, gameState: this.gameState });
    return { type: "normal", encounter, rewardGold, rechargeResult, deferredRewards };
  }
}
