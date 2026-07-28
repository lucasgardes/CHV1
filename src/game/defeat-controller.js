"use strict";

import { GAME_STATUS } from "./game-state.js";

const PROTECTION_ORDER = Object.freeze([
  { id:"delayed-protection", armed:true, consumable:false },
  { id:"second-chance", consumable:true },
  { id:"mini-checkpoint", consumable:true },
  { id:"last-stand", consumable:false }
]);

export class DefeatController {
  constructor({ gameState, mapController, itemController = null }) {
    if (!gameState || !mapController) throw new Error("Les contrôleurs de partie sont requis.");
    Object.assign(this, { gameState, mapController, itemController });
  }
  findProtection() {
    return PROTECTION_ORDER.find((protection) => {
      if (protection.armed) return this.gameState.nextEncounterProtectionArmed === true;
      if (!this.gameState.hasItem(protection.id)) return false;
      return protection.consumable || !this.gameState.isDefeatProtectionConsumed(protection.id);
    }) ?? null;
  }
  findPreviousNodeId(steps = 1) {
    const history = [...this.gameState.completedNodeIds].reverse();
    if (!history.length) return this.mapController.getMap().startNodeId;
    return history[Math.min(history.length - 1, Math.max(0, steps - 1))] ?? this.mapController.getMap().startNodeId;
  }
  consumeProtection(protection) {
    if (protection.armed) this.gameState.consumeNextEncounterProtection();
    else if (protection.consumable) this.gameState.removeItem(protection.id);
    else this.gameState.consumeDefeatProtection(protection.id);
  }
  values(itemId, fallback) { return this.itemController?.getEffectiveValues(itemId) ?? fallback; }
  processDefeat() {
    const protection = this.findProtection();
    if (!protection) {
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.GAME_OVER);
      return { protected:false, protectionId:null, action:"game-over", returnNodeId:null, restartRun:true };
    }

    this.consumeProtection(protection);

    // Une protection contre la défaite ne relance jamais une vidéo et ne la rembobine pas.
    // Le contrôleur de rencontre doit terminer le round par son flux de réussite normal afin
    // d'appliquer correctement la progression, les récompenses et les recharges.
    this.gameState.setStatus(GAME_STATUS.ENCOUNTER);
    return {
      protected:true,
      protectionId:protection.id,
      action:"complete-current-encounter",
      returnNodeId:this.gameState.currentNodeId,
      restartRun:false
    };
  }
}
