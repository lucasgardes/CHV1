"use strict";

import { getItemById, ITEM_TYPES } from "../data/items.js";

export class AdvancedItemService {
  constructor({ gameState, itemController, mapController = null, random = Math.random }) {
    this.gameState = gameState;
    this.itemController = itemController;
    this.mapController = mapController;
    this.random = random;
  }

  resetForRun() {
    this.gameState.itemRunState = {
      metronomeStreak: 0,
      rescueUsedInEncounter: false,
      doubleCommandUsed: false,
      doubleCommandStoredItemId: null,
      doubleBetAccepted: false,
      fastPathRows: [],
      recyclerReady: true,
      directorChoice: null,
      utilitySlotsUsed: []
    };
  }

  state() {
    if (!this.gameState.itemRunState) this.resetForRun();
    return this.gameState.itemRunState;
  }

  getActiveItemCapacity() {
    const base = 3;
    if (!this.gameState.hasItem("utility-belt")) return base;
    return base + Math.max(0, Number(this.itemController.getEffectiveValues("utility-belt")?.slots) || 0);
  }

  canEquipActiveItem(itemId) {
    const item = getItemById(itemId);
    if (!item || ![ITEM_TYPES.CONSUMABLE, ITEM_TYPES.RECHARGEABLE].includes(item.type)) return true;
    const equipped = this.state().utilitySlotsUsed;
    return equipped.includes(itemId) || equipped.length < this.getActiveItemCapacity();
  }

  equipActiveItem(itemId) {
    if (!this.canEquipActiveItem(itemId)) return false;
    const equipped = this.state().utilitySlotsUsed;
    if (!equipped.includes(itemId)) equipped.push(itemId);
    return true;
  }

  markRescueItemUsed() {
    const state = this.state();
    state.rescueUsedInEncounter = true;
    state.metronomeStreak = 0;
  }

  completeEncounterWithoutRescue() {
    const state = this.state();
    if (state.rescueUsedInEncounter) {
      state.rescueUsedInEncounter = false;
      state.metronomeStreak = 0;
      return 0;
    }
    state.metronomeStreak += 1;
    if (!this.gameState.hasItem("metronome")) return 0;
    const values = this.itemController.getEffectiveValues("metronome") ?? {};
    return Math.min(Number(values.max) || 0, state.metronomeStreak * (Number(values.step) || 0));
  }

  beginEncounter() { this.state().rescueUsedInEncounter = false; }

  acceptDoubleBet(accepted) {
    const state = this.state();
    state.doubleBetAccepted = Boolean(accepted && this.gameState.hasItem("double-bet"));
    return state.doubleBetAccepted;
  }

  consumeDoubleBet() {
    const state = this.state();
    const accepted = state.doubleBetAccepted;
    state.doubleBetAccepted = false;
    if (!accepted) return { rewardMultiplier: 1, difficultyShift: 0 };
    return { rewardMultiplier: 2, difficultyShift: 1 };
  }

  canUseDoubleCommand(itemId) {
    const state = this.state();
    if (!this.gameState.hasItem("double-command") || state.doubleCommandUsed) return false;
    const values = this.itemController.getEffectiveValues("double-command") ?? {};
    return values.mustBeConsecutive === false || state.doubleCommandStoredItemId === null || state.doubleCommandStoredItemId === itemId;
  }

  consumeDoubleCommand(itemId) {
    if (!this.canUseDoubleCommand(itemId)) return false;
    const state = this.state();
    state.doubleCommandUsed = true;
    state.doubleCommandStoredItemId = itemId;
    return true;
  }

  canFastPath(node) {
    const state = this.state();
    return this.gameState.hasItem("fast-path") && node?.type === "normal" && !state.fastPathRows.includes(node.row);
  }

  consumeFastPath(node) {
    if (!this.canFastPath(node)) return false;
    this.state().fastPathRows.push(node.row);
    return true;
  }

  getDirectorChoices(encounterId, videos) {
    if (!this.gameState.hasItem("director-eye")) return [];
    const current = videos.find((video) => video.id === encounterId);
    if (!current) return [];
    const candidates = videos.filter((video) => video.type === current.type && video.id !== current.id);
    if (!candidates.length) return [current];
    const alternate = candidates[Math.floor(this.random() * candidates.length)];
    return [current, alternate];
  }
}
