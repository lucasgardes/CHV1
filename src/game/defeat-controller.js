"use strict";

import { GAME_STATUS } from "./game-state.js";

const PROTECTIONS = Object.freeze([
  { id: "second-chance", consumable: true },
  { id: "mini-checkpoint", consumable: true },
  { id: "last-stand", consumable: false }
]);

export class DefeatController {
  constructor({ gameState, mapController }) {
    if (!gameState || !mapController) throw new Error("Les contrôleurs de partie sont requis.");
    this.gameState = gameState;
    this.mapController = mapController;
  }

  findProtection() {
    return PROTECTIONS.find(({ id, consumable }) => {
      if (!this.gameState.hasItem(id)) return false;
      return consumable || !this.gameState.isDefeatProtectionConsumed(id);
    }) ?? null;
  }

  processDefeat() {
    const protection = this.findProtection();

    if (protection) {
      if (protection.consumable) this.gameState.removeItem(protection.id);
      else this.gameState.consumeDefeatProtection(protection.id);

      this.gameState.completeCurrentNode();
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.MAP);
      this.gameState.saveResumeSnapshot(this.mapController.getMap().seed);

      return { protected: true, protectionId: protection.id };
    }

    this.gameState.clearResumeSnapshot();
    this.gameState.setCurrentEncounter(null);
    this.gameState.setStatus(GAME_STATUS.GAME_OVER);
    return { protected: false, protectionId: null };
  }
}
