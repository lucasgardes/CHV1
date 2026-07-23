"use strict";

import { getItemById, getItemValues, getItemRecharge, RECHARGE_TYPES } from "../data/items.js";
import { registerItemController } from "./runtime-access.js";

export class ItemController {
  constructor({ gameState }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.gameState = gameState;
    this.runtimeStates = new Map();
    this.encounterLock = false;
    this.recyclerUsedThisPeriod = false;
    registerItemController(this);
  }

  ensureRuntimeState(itemId) {
    if (!this.runtimeStates.has(itemId)) this.runtimeStates.set(itemId, { available:true, active:false, remainingRechargeRounds:0, consumedForRun:false });
    return this.runtimeStates.get(itemId);
  }

  resetForRun() {
    this.runtimeStates.clear();
    this.encounterLock = false;
    this.recyclerUsedThisPeriod = false;
    for (const itemId of this.gameState.inventory) this.ensureRuntimeState(itemId);
  }
  setEncounterLock(locked) { this.encounterLock = locked === true; }
  hasItem(itemId) { return this.gameState.hasItem(itemId); }
  isAvailable(itemId) {
    if (!this.hasItem(itemId) || this.gameState.isItemDisabled?.(itemId) || this.encounterLock) return false;
    const state = this.ensureRuntimeState(itemId);
    return state.available && !state.active;
  }
  isActive(itemId) { return this.ensureRuntimeState(itemId).active; }
  activate(itemId) {
    if (!this.hasItem(itemId)) throw new Error(`L’objet ${itemId} n’est pas possédé.`);
    if (this.encounterLock) throw new Error("Les objets activables sont bloqués pendant cette rencontre.");
    if (this.gameState.isItemDisabled?.(itemId)) throw new Error(`L’objet ${itemId} est temporairement désactivé.`);
    const state = this.ensureRuntimeState(itemId);
    if (!state.available) throw new Error(`L’objet ${itemId} n’est pas disponible.`);
    if (state.active) throw new Error(`L’objet ${itemId} est déjà actif.`);
    state.active = true;
  }
  finishActivation(itemId) { this.ensureRuntimeState(itemId).active = false; }
  consumeCharge(itemId) {
    const item = getItemById(itemId); const state = this.ensureRuntimeState(itemId); const recharge = this.getEffectiveRecharge(itemId);
    state.available = false; state.active = true; state.remainingRechargeRounds = 0;
    if (item?.type !== "rechargeable") return;
    switch (recharge?.type) {
      case RECHARGE_TYPES.ENCOUNTERS:
      case RECHARGE_TYPES.ELITE_OR_ENCOUNTERS:
        state.remainingRechargeRounds = Math.max(1, Number(recharge.amount) || 1); break;
      case RECHARGE_TYPES.ELITE:
        state.remainingRechargeRounds = -1; break;
      case RECHARGE_TYPES.ONCE_PER_RUN:
      case RECHARGE_TYPES.NONE:
        state.consumedForRun = true; break;
      default:
        state.remainingRechargeRounds = 1;
    }
  }
  recharge(itemId) { const state = this.ensureRuntimeState(itemId); state.available = true; state.active = false; state.remainingRechargeRounds = 0; }
  rechargeAll() { for (const itemId of this.gameState.inventory) if (getItemById(itemId)?.type === "rechargeable") this.recharge(itemId); }

  advanceRechargeCounters({ encounterType="normal" }={}) {
    const rechargedItemIds = [];
    const batteryValues = this.gameState.hasItem("external-battery") ? this.getEffectiveValues("external-battery") : null;
    const passiveReduction = Math.max(0, Number(batteryValues?.rounds) || 0);
    for (const itemId of this.gameState.inventory) {
      const item = getItemById(itemId); const recharge = this.getEffectiveRecharge(itemId); const state = this.ensureRuntimeState(itemId);
      if (item?.type !== "rechargeable" || state.available || state.active) continue;
      if (recharge?.type === RECHARGE_TYPES.ELITE) { if (encounterType === "elite") { this.recharge(itemId); rechargedItemIds.push(itemId); } continue; }
      if (recharge?.type === RECHARGE_TYPES.ELITE_OR_ENCOUNTERS && encounterType === "elite") { this.recharge(itemId); rechargedItemIds.push(itemId); continue; }
      if (recharge?.type !== RECHARGE_TYPES.ENCOUNTERS && recharge?.type !== RECHARGE_TYPES.ELITE_OR_ENCOUNTERS) continue;
      state.remainingRechargeRounds = Math.max(0, state.remainingRechargeRounds - 1 - passiveReduction);
      if (state.remainingRechargeRounds === 0) { this.recharge(itemId); rechargedItemIds.push(itemId); }
    }

    const secondaryReduction = Math.max(0, Number(batteryValues?.secondaryReduction) || 0);
    if (secondaryReduction > 0 && rechargedItemIds.length > 0) {
      const secondary = this.gameState.inventory.find((itemId) => {
        const item = getItemById(itemId); const state = this.ensureRuntimeState(itemId);
        return item?.type === "rechargeable" && !state.available && state.remainingRechargeRounds > 0;
      });
      if (secondary) this.ensureRuntimeState(secondary).remainingRechargeRounds = Math.max(0, this.ensureRuntimeState(secondary).remainingRechargeRounds - secondaryReduction);
    }

    if (encounterType === "elite") this.recyclerUsedThisPeriod = false;
    return { encounterType, rechargedItemIds };
  }

  shouldPreserveConsumable(random = Math.random) {
    if (!this.gameState.hasItem("recycler") || this.recyclerUsedThisPeriod) return false;
    this.recyclerUsedThisPeriod = true;
    const chance = Math.max(0, Math.min(1, Number(this.getEffectiveValues("recycler")?.chance) || 0));
    return random() < chance;
  }

  resetForEncounter() { for (const itemId of this.gameState.inventory) this.ensureRuntimeState(itemId); }
  getEffectiveValues(itemId) { return getItemValues(itemId, this.gameState.isItemUpgraded(itemId)); }
  getEffectiveRecharge(itemId) { return getItemRecharge(itemId, this.gameState.isItemUpgraded(itemId)); }
  getState(itemId) { return { ...this.ensureRuntimeState(itemId), disabled: this.gameState.isItemDisabled?.(itemId) === true, encounterLocked:this.encounterLock }; }
}
