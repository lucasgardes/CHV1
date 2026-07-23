"use strict";

import { registerGameState } from "./runtime-access.js";

export const GAME_STATUS = Object.freeze({ MENU:"menu", MAP:"map", ENCOUNTER:"encounter", REWARD:"reward", GAME_OVER:"game-over", VICTORY:"victory", EVENT:"event", SHOP:"shop", CAMPFIRE:"campfire" });

function normalizeModifier(modifier = {}) {
  return {
    source: modifier.source ?? "unknown",
    encountersRemaining: Math.max(1, Number(modifier.encountersRemaining) || 1),
    durationSeconds: Number(modifier.durationSeconds) || 0,
    rewardGoldFlat: Number(modifier.rewardGoldFlat) || 0,
    rewardMultiplier: Number.isFinite(modifier.rewardMultiplier) ? modifier.rewardMultiplier : 1,
    intensityShift: Number(modifier.intensityShift) || 0,
    hideInterfaceSeconds: Math.max(0, Number(modifier.hideInterfaceSeconds) || 0)
  };
}

function createItemRunState() {
  return {
    metronomeStreak: 0,
    rescueUsedInEncounter: false,
    doubleCommandUsed: false,
    doubleCommandPendingItemId: null,
    fastPathRows: [],
    recyclerReady: true,
    directorChoice: null,
    utilitySlotsUsed: [],
    encounterHistory: []
  };
}

export class GameState {
  constructor() { this.reset(); registerGameState(this); }
  reset() {
    this.status = GAME_STATUS.MENU; this.gold = 50; this.inventory = []; this.upgradedItemIds = [];
    this.totalGoldEarned = 0; this.totalGoldSpent = 0; this.totalGoldLost = 0; this.elitesDefeated = 0;
    this.consumedDefeatProtectionIds = []; this.currentNodeId = null; this.completedNodeIds = [];
    this.currentEncounter = null; this.nextFunscriptDifficultyShift = 0; this.nextEncounterProtectionArmed = false;
    this.seenEventIds = []; this.pendingEncounterModifiers = []; this.disabledItems = {}; this.cobayeRelations = {};
    this.eventFlags = {}; this.runFlags = {}; this.nextShopPriceMultiplier = 1; this.nextEliteRareChanceBonus = 0;
    this.itemRunState = createItemRunState();
  }
  startRun(startNodeId = "start") { this.reset(); this.status = GAME_STATUS.MAP; this.currentNodeId = startNodeId; }
  setStatus(status) { if (!Object.values(GAME_STATUS).includes(status)) throw new Error(`Statut de partie invalide : ${status}`); this.status = status; }
  setCurrentEncounter(encounter) { this.currentEncounter = encounter; }
  recordEncounterCheckpoint(entry) { if (entry) this.itemRunState.encounterHistory.push({ ...entry }); }
  getEncounterHistory() { return this.itemRunState.encounterHistory.map((entry) => ({ ...entry })); }
  armNextEncounterProtection() { this.nextEncounterProtectionArmed = true; }
  consumeNextEncounterProtection() { const armed = this.nextEncounterProtectionArmed; this.nextEncounterProtectionArmed = false; return armed; }
  queueNextFunscriptDifficultyShift(amount) { if (!Number.isInteger(amount) || amount === 0) throw new Error("Le changement de difficulté doit être un entier non nul."); this.nextFunscriptDifficultyShift = Math.max(-2, Math.min(2, this.nextFunscriptDifficultyShift + amount)); }
  consumeNextFunscriptDifficultyShift() { const shift = this.nextFunscriptDifficultyShift; this.nextFunscriptDifficultyShift = 0; return shift; }
  markEventSeen(eventId) { if (eventId && !this.seenEventIds.includes(eventId)) this.seenEventIds.push(eventId); }
  hasSeenEvent(eventId) { return this.seenEventIds.includes(eventId); }
  addEncounterModifier(modifier) { const normalized = normalizeModifier(modifier); this.pendingEncounterModifiers.push(normalized); return normalized; }
  consumeEncounterModifiers() { const active = this.pendingEncounterModifiers.map((modifier) => ({ ...modifier })); this.pendingEncounterModifiers = this.pendingEncounterModifiers.map((modifier) => ({ ...modifier, encountersRemaining: modifier.encountersRemaining - 1 })).filter((modifier) => modifier.encountersRemaining > 0); return active; }
  disableItem(itemId, encounters = 2) { if (!this.hasItem(itemId)) return false; this.disabledItems[itemId] = Math.max(1, Number(encounters) || 1); return true; }
  isItemDisabled(itemId) { return (this.disabledItems[itemId] ?? 0) > 0; }
  advanceDisabledItems() { for (const [itemId, remaining] of Object.entries(this.disabledItems)) { const next = remaining - 1; if (next <= 0) delete this.disabledItems[itemId]; else this.disabledItems[itemId] = next; } }
  adjustCobayeRelation(cobayeId, amount) { const next = (this.cobayeRelations[cobayeId] ?? 0) + amount; this.cobayeRelations[cobayeId] = next; return next; }
  setEventFlag(flag, value = true) { this.eventFlags[flag] = value; return value; }
  getEventFlag(flag) { return this.eventFlags[flag]; }
  setRunFlag(flag, value = true) { this.runFlags[flag] = value; return value; }
  getRunFlag(flag) { return this.runFlags[flag]; }
  consumeRunFlag(flag, fallback = null) { const value = Object.hasOwn(this.runFlags, flag) ? this.runFlags[flag] : fallback; delete this.runFlags[flag]; return value; }
  multiplyNextShopPrices(multiplier) { this.nextShopPriceMultiplier = Math.max(0.1, this.nextShopPriceMultiplier * multiplier); }
  consumeNextShopPriceMultiplier() { const value = this.nextShopPriceMultiplier; this.nextShopPriceMultiplier = 1; return value; }
  addNextEliteRareChanceBonus(amount) { this.nextEliteRareChanceBonus = Math.max(0, this.nextEliteRareChanceBonus + amount); }
  consumeNextEliteRareChanceBonus() { const value = this.nextEliteRareChanceBonus; this.nextEliteRareChanceBonus = 0; return value; }
  completeCurrentNode() { if (this.currentNodeId !== null && !this.completedNodeIds.includes(this.currentNodeId)) this.completedNodeIds.push(this.currentNodeId); }
  moveToNode(nodeId) { if (typeof nodeId !== "string" || nodeId.trim() === "") throw new Error("L’identifiant de la case est invalide."); this.currentNodeId = nodeId; }
  addGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or ajoutée est invalide."); this.gold += amount; this.totalGoldEarned += amount; }
  spendGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or dépensée est invalide."); if (this.gold < amount) return false; this.gold -= amount; this.totalGoldSpent += amount; return true; }
  loseGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or perdue est invalide."); const lost = Math.min(this.gold, amount); this.gold -= lost; this.totalGoldLost += lost; return lost; }
  hasItem(itemId) { return this.inventory.includes(itemId); }
  addItem(itemId) { if (this.hasItem(itemId)) return false; this.inventory.push(itemId); return true; }
  removeItem(itemId) { const index = this.inventory.indexOf(itemId); if (index < 0) return false; this.inventory.splice(index, 1); this.upgradedItemIds = this.upgradedItemIds.filter((id) => id !== itemId); delete this.disabledItems[itemId]; return true; }
  isDefeatProtectionConsumed(itemId) { return this.consumedDefeatProtectionIds.includes(itemId); }
  consumeDefeatProtection(itemId) { if (this.isDefeatProtectionConsumed(itemId)) return false; this.consumedDefeatProtectionIds.push(itemId); return true; }
  isItemUpgraded(itemId) { return this.upgradedItemIds.includes(itemId); }
  upgradeItem(itemId) { if (!this.hasItem(itemId) || this.isItemUpgraded(itemId)) return false; this.upgradedItemIds.push(itemId); return true; }
}