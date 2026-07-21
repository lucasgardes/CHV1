"use strict";

import {
  getMapNodeById
} from "./map-data.js";

export class MapController {
  constructor({ gameState }) {
    if (!gameState) {
      throw new Error("L’état de partie est requis.");
    }

    this.gameState = gameState;
  }

  getCurrentNode() {
    return getMapNodeById(this.gameState.currentNodeId);
  }

  getAccessibleNodes() {
    const currentNode = this.getCurrentNode();

    if (currentNode === null) {
      return [];
    }

    return currentNode.nextNodeIds
      .map((nodeId) => getMapNodeById(nodeId))
      .filter((node) => node !== null);
  }

  moveToNode(nodeId) {
    const accessibleNodes = this.getAccessibleNodes();

    const targetNode = accessibleNodes.find(
      (node) => node.id === nodeId
    );

    if (!targetNode) {
      throw new Error(
        `La case ${nodeId} n’est pas accessible.`
      );
    }

    const currentNode = this.getCurrentNode();

    if (
      currentNode !== null &&
      currentNode.type === "start"
    ) {
      this.gameState.completeCurrentNode();
    }

    this.gameState.moveToNode(targetNode.id);

    return targetNode;
  }
}