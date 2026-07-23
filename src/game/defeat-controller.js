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

  findPreviousNodeId() {
    const currentNode = this.mapController.getCurrentNode();
    if (!currentNode) return this.mapController.getMap().startNodeId;

    const completedIds = [...this.gameState.completedNodeIds].reverse();
    for (const nodeId of completedIds) {
      const node = this.mapController.getNodeById(nodeId);
      if (node?.nextNodeIds?.includes(currentNode.id)) return node.id;
    }

    return this.mapController.getMap().startNodeId;
  }

  processDefeat() {
    const protection = this.findProtection();

    if (protection) {
      if (protection.consumable) this.gameState.removeItem(protection.id);
      else this.gameState.consumeDefeatProtection(protection.id);

      const returnNodeId = this.findPreviousNodeId();
      this.gameState.setCurrentEncounter(null);
      this.gameState.moveToNode(returnNodeId);
      this.gameState.setStatus(GAME_STATUS.MAP);
      this.gameState.clearResumeSnapshot();

      return {
        protected: true,
        protectionId: protection.id,
        returnNodeId,
        restartRun: false
      };
    }

    this.gameState.clearResumeSnapshot();
    this.gameState.setCurrentEncounter(null);
    this.gameState.setStatus(GAME_STATUS.GAME_OVER);
    return {
      protected: false,
      protectionId: null,
      returnNodeId: null,
      restartRun: true
    };
  }
}
