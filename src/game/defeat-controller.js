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

  processDefeat() {
    const protection = this.findProtection();
    if (!protection) {
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.GAME_OVER);
      return { protected:false, protectionId:null, action:"game-over", returnNodeId:null, restartRun:true };
    }

    this.consumeProtection(protection);
    const upgraded = this.gameState.isItemUpgraded(protection.id);

    if (protection.id === "second-chance") {
      const pauseSeconds = Number(this.itemController?.getEffectiveValues("second-chance")?.pauseSeconds) || (upgraded ? 10 : 0);
      this.gameState.setStatus(GAME_STATUS.ENCOUNTER);
      return { protected:true, protectionId:protection.id, action:"restart-current-encounter", pauseSeconds, returnNodeId:null, restartRun:false };
    }

    if (protection.id === "mini-checkpoint") {
      const rewindRounds = Number(this.itemController?.getEffectiveValues("mini-checkpoint")?.rewindRounds) || (upgraded ? 1 : 2);
      this.gameState.setStatus(GAME_STATUS.ENCOUNTER);
      return { protected:true, protectionId:protection.id, action:"rewind-current-encounter", rewindRounds, returnNodeId:null, restartRun:false };
    }

    if (protection.id === "delayed-protection") {
      const rewardMultiplier = Number(this.itemController?.getEffectiveValues("delayed-protection")?.rewardMultiplier) || 0;
      this.gameState.completeCurrentNode();
      this.gameState.setCurrentEncounter(null);
      this.gameState.setStatus(GAME_STATUS.MAP);
      return { protected:true, protectionId:protection.id, action:"complete-encounter", rewardMultiplier, returnNodeId:this.gameState.currentNodeId, restartRun:false };
    }

    const pauseSeconds = Number(this.itemController?.getEffectiveValues("last-stand")?.pauseSeconds) || 0;
    const returnNodeId = this.findPreviousNodeId(1);
    this.gameState.setCurrentEncounter(null);
    this.gameState.moveToNode(returnNodeId);
    this.gameState.setStatus(GAME_STATUS.MAP);
    return { protected:true, protectionId:protection.id, action:"survive", pauseSeconds, returnNodeId, restartRun:false };
  }
}
