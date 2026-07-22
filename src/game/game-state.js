"use strict";

import { registerGameState } from "./runtime-access.js";

export const GAME_STATUS = Object.freeze({ MENU:"menu", MAP:"map", ENCOUNTER:"encounter", REWARD:"reward", GAME_OVER:"game-over", VICTORY:"victory", EVENT:"event", SHOP:"shop", CAMPFIRE:"campfire" });
const RESUME_KEY = "chv:defeat-resume";
function storage() { try { return globalThis.sessionStorage ?? null; } catch { return null; } }

export class GameState {
  constructor() { this.reset(); registerGameState(this); }
  reset() {
    this.status = GAME_STATUS.MENU; this.gold = 50; this.inventory = []; this.upgradedItemIds = [];
    this.consumedDefeatProtectionIds = []; this.currentNodeId = null; this.completedNodeIds = [];
    this.currentEncounter = null; this.nextFunscriptDifficultyShift = 0;
  }
  startRun(startNodeId = "start") {
    const snapshot = this.consumeResumeSnapshot();
    if (snapshot) { Object.assign(this, snapshot, { status: GAME_STATUS.MAP, currentEncounter: null }); return; }
    this.reset(); this.status = GAME_STATUS.MAP; this.currentNodeId = startNodeId;
  }
  saveResumeSnapshot(mapSeed) {
    storage()?.setItem(RESUME_KEY, JSON.stringify({ mapSeed, state: {
      gold:this.gold, inventory:[...this.inventory], upgradedItemIds:[...this.upgradedItemIds],
      consumedDefeatProtectionIds:[...this.consumedDefeatProtectionIds], currentNodeId:this.currentNodeId,
      completedNodeIds:[...this.completedNodeIds], nextFunscriptDifficultyShift:this.nextFunscriptDifficultyShift
    }}));
  }
  peekResumeSnapshot() { const raw = storage()?.getItem(RESUME_KEY); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }
  consumeResumeSnapshot() { const value = this.peekResumeSnapshot(); storage()?.removeItem(RESUME_KEY); return value?.state ?? null; }
  clearResumeSnapshot() { storage()?.removeItem(RESUME_KEY); }
  setStatus(status) { if (!Object.values(GAME_STATUS).includes(status)) throw new Error(`Statut de partie invalide : ${status}`); this.status = status; }
  setCurrentEncounter(encounter) { this.currentEncounter = encounter; }
  queueNextFunscriptDifficultyShift(amount) {
    if (!Number.isInteger(amount) || amount === 0) throw new Error("Le changement de difficulté doit être un entier non nul.");
    this.nextFunscriptDifficultyShift = Math.max(-2, Math.min(2, this.nextFunscriptDifficultyShift + amount));
  }
  consumeNextFunscriptDifficultyShift() { const shift = this.nextFunscriptDifficultyShift; this.nextFunscriptDifficultyShift = 0; return shift; }
  completeCurrentNode() { if (this.currentNodeId !== null && !this.completedNodeIds.includes(this.currentNodeId)) this.completedNodeIds.push(this.currentNodeId); }
  moveToNode(nodeId) { if (typeof nodeId !== "string" || nodeId.trim() === "") throw new Error("L’identifiant de la case est invalide."); this.currentNodeId = nodeId; }
  addGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or ajoutée est invalide."); this.gold += amount; }
  spendGold(amount) { if (!Number.isFinite(amount) || amount < 0) throw new Error("La quantité d’or dépensée est invalide."); if (this.gold < amount) return false; this.gold -= amount; return true; }
  hasItem(itemId) { return this.inventory.includes(itemId); }
  addItem(itemId) { if (this.hasItem(itemId)) return false; this.inventory.push(itemId); return true; }
  removeItem(itemId) { const index = this.inventory.indexOf(itemId); if (index < 0) return false; this.inventory.splice(index, 1); this.upgradedItemIds = this.upgradedItemIds.filter((id) => id !== itemId); return true; }
  isDefeatProtectionConsumed(itemId) { return this.consumedDefeatProtectionIds.includes(itemId); }
  consumeDefeatProtection(itemId) { if (this.isDefeatProtectionConsumed(itemId)) return false; this.consumedDefeatProtectionIds.push(itemId); return true; }
  isItemUpgraded(itemId) { return this.upgradedItemIds.includes(itemId); }
  upgradeItem(itemId) { if (!this.hasItem(itemId) || this.isItemUpgraded(itemId)) return false; this.upgradedItemIds.push(itemId); return true; }
}
