"use strict";

import {
  getItemById,
  getItemValues
} from "../data/items.js";

import {
  registerItemController
} from "./game-runtime.js";

export class ItemController {
  constructor({ gameState }) {
    if (!gameState) {
      throw new Error("L’état de partie est requis.");
    }

    this.gameState = gameState;
    this.runtimeStates = new Map();
    registerItemController(this);
  }

  ensureRuntimeState(itemId) {
    if (!this.runtimeStates.has(itemId)) {
      this.runtimeStates.set(itemId, {
        available: true,
        active: false,
        remainingRechargeRounds: 0
      });
    }

    return this.runtimeStates.get(itemId);
  }

  hasItem(itemId) {
    return this.gameState.hasItem(itemId);
  }

  isAvailable(itemId) {
    if (!this.hasItem(itemId)) return false;
    const state = this.ensureRuntimeState(itemId);
    return state.available && !state.active;
  }

  isActive(itemId) {
    return this.ensureRuntimeState(itemId).active;
  }

  activate(itemId) {
    if (!this.hasItem(itemId)) {
      throw new Error(`L’objet ${itemId} n’est pas possédé.`);
    }

    const state = this.ensureRuntimeState(itemId);

    if (!state.available) {
      throw new Error(`L’objet ${itemId} n’est pas disponible.`);
    }

    if (state.active) {
      throw new Error(`L’objet ${itemId} est déjà actif.`);
    }

    state.active = true;
  }

  finishActivation(itemId) {
    this.ensureRuntimeState(itemId).active = false;
  }

  consumeCharge(itemId) {
    const item = getItemById(itemId);
    const state = this.ensureRuntimeState(itemId);
    const values = this.getEffectiveValues(itemId);

    state.available = false;
    state.remainingRechargeRounds = item?.type === "rechargeable"
      ? Math.max(1, Number(values?.rechargeRounds) || 1)
      : 0;
  }

  recharge(itemId) {
    const state = this.ensureRuntimeState(itemId);
    state.available = true;
    state.active = false;
    state.remainingRechargeRounds = 0;
  }

  rechargeAll() {
    for (const itemId of this.gameState.inventory) {
      if (getItemById(itemId)?.type === "rechargeable") {
        this.recharge(itemId);
      }
    }
  }

  advanceRechargeCounters({ encounterType = "normal" } = {}) {
    const rechargedItemIds = [];

    for (const itemId of this.gameState.inventory) {
      const item = getItemById(itemId);
      const state = this.ensureRuntimeState(itemId);

      if (
        item?.type !== "rechargeable" ||
        state.available ||
        state.active ||
        state.remainingRechargeRounds <= 0
      ) {
        continue;
      }

      state.remainingRechargeRounds -= 1;

      if (state.remainingRechargeRounds <= 0) {
        this.recharge(itemId);
        rechargedItemIds.push(itemId);
      }
    }

    return {
      encounterType,
      rechargedItemIds
    };
  }

  resetForEncounter() {
    for (const itemId of this.gameState.inventory) {
      this.ensureRuntimeState(itemId);
    }
  }

  getEffectiveValues(itemId) {
    return getItemValues(
      itemId,
      this.gameState.isItemUpgraded(itemId)
    );
  }

  getState(itemId) {
    const state = this.ensureRuntimeState(itemId);

    return {
      available: state.available,
      active: state.active,
      remainingRechargeRounds: state.remainingRechargeRounds
    };
  }
}
