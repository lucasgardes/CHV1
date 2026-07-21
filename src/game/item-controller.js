"use strict";

export class ItemController {
  constructor({ gameState }) {
    if (!gameState) {
      throw new Error(
        "L’état de partie est requis."
      );
    }

    this.gameState = gameState;
    this.runtimeStates = new Map();
  }

  ensureRuntimeState(itemId) {
    if (!this.runtimeStates.has(itemId)) {
      this.runtimeStates.set(itemId, {
        available: true,
        active: false
      });
    }

    return this.runtimeStates.get(itemId);
  }

  hasItem(itemId) {
    return this.gameState.hasItem(itemId);
  }

  isAvailable(itemId) {
    if (!this.hasItem(itemId)) {
      return false;
    }

    const state =
      this.ensureRuntimeState(itemId);

    return state.available && !state.active;
  }

  isActive(itemId) {
    const state =
      this.ensureRuntimeState(itemId);

    return state.active;
  }

  activate(itemId) {
    if (!this.hasItem(itemId)) {
      throw new Error(
        `L’objet ${itemId} n’est pas possédé.`
      );
    }

    const state =
      this.ensureRuntimeState(itemId);

    if (!state.available) {
      throw new Error(
        `L’objet ${itemId} n’est pas disponible.`
      );
    }

    if (state.active) {
      throw new Error(
        `L’objet ${itemId} est déjà actif.`
      );
    }

    state.active = true;
  }

  finishActivation(itemId) {
    const state =
      this.ensureRuntimeState(itemId);

    state.active = false;
  }

  consumeCharge(itemId) {
    const state =
      this.ensureRuntimeState(itemId);

    state.available = false;
  }

  recharge(itemId) {
    const state =
      this.ensureRuntimeState(itemId);

    state.available = true;
    state.active = false;
  }

  resetForEncounter() {
    for (const itemId of this.gameState.inventory) {
      switch (itemId) {
        case "time-out":
          this.recharge(itemId);
          break;

        default:
          this.ensureRuntimeState(itemId);
          break;
      }
    }
  }

  getState(itemId) {
    const state =
      this.ensureRuntimeState(itemId);

    return {
      available: state.available,
      active: state.active
    };
  }
}