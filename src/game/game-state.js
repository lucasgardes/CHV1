"use strict";

import { registerGameState } from "./runtime-access.js";

export const GAME_STATUS = Object.freeze({ MENU:"menu", MAP:"map", ENCOUNTER:"encounter", REWARD:"reward", GAME_OVER:"game-over", VICTORY:"victory", EVENT:"event", SHOP:"shop", CAMPFIRE:"campfire" });

export class GameState {
  constructor() { this.reset(); registerGameState(this); }
  reset() {
    this.status = GAME_STATUS.MENU;
    this.gold = 50;
    this.inventory = [];
    this.upgradedItemIds = [];
    this.consumedDefeatProtectionIds = [];
    this.currentNodeId = null;
    this.completedNodeIds = [];
    this.currentEncounter = null;
    this.nextFunscriptDifficultyShift = 0;
    this.nextEncounterProtectionArmed = false;
  }
  startRun(startNodeId = "start") { this.reset(); this.status = GAME_STATUS.MAP; this.currentNodeId = startNodeId; }
  setStatus(status) { if (!Object.values(GAME_STATUS).includes(status)) throw new Error(`Statut de partie invalide : ${status}`); this.status = status; }
  setCurrentEncounter(encounter) { this.currentEncounter = encounter; }
  armNextEncounterProtection() { this.nextEncounterProtectionArmed = true; }
  consumeNextEncounterProtection() { const armed = this.nextEncounterProtectionArmed; this.nextEncounterProtectionArmed = false; return armed; }
  queueNextFunscriptDifficultyShift(amount) {
    if (!Number.isInteger(amount) || amount === 0) throw new Error("Le changement de difficulté doit être un entier non nul.");
    this.nextFunscriptDifficultyShift = Math.max(-2, Math.min(2, this.nextFunscriptDifficultyShift + amount));
  }
  consumeNextFunscriptDifficultyShift() { const shift = this.nextFunscriptDifficultyShift; this.nextFunscriptDifficultyShift = 0; return shift; }
  completeCurrentNode() { if (this.currentNodeId !== null && !this.completedNodeIds.includes(this.currentNodeId)) this.completedNodeIds.push(this.currentNodeId); }
  moveToNode(nodeId) { if (typeof nodeId !== "string" || nodeId.trim() === "") throw new Error("L’identifiant de la case est invalide."); this.currentNodeId = nodeId; }
  addGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or ajoutée est invalide."); this.gold += amount; }
  spendGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or dépensée est invalide."); if (this.gold < amount) return false; this.gold -= amount; return true; }
  loseGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or perdue est invalide."); const lost = Math.min(this.gold, amount); this.gold -= lost; return lost; }
  hasItem(itemId) { return this.inventory.includes(itemId); }
  addItem(itemId) { if (this.hasItem(itemId)) return false; this.inventory.push(itemId); return true; }
  removeItem(itemId) { const index = this.inventory.indexOf(itemId); if (index < 0) return false; this.inventory.splice(index, 1); this.upgradedItemIds = this.upgradedItemIds.filter((id) => id !== itemId); return true; }
  isDefeatProtectionConsumed(itemId) { return this.consumedDefeatProtectionIds.includes(itemId); }
  consumeDefeatProtection(itemId) { if (this.isDefeatProtectionConsumed(itemId)) return false; this.consumedDefeatProtectionIds.push(itemId); return true; }
  isItemUpgraded(itemId) { return this.upgradedItemIds.includes(itemId); }
  upgradeItem(itemId) { if (!this.hasItem(itemId) || this.isItemUpgraded(itemId)) return false; this.upgradedItemIds.push(itemId); return true; }
}
