"use strict";

import {
  generateMap
} from "./map-generator.js";

export class MapController {
  constructor({ gameState, seed } = {}) {
    if (!gameState) {
      throw new Error("L’état de partie est requis.");
    }

    this.gameState = gameState;
    this.map = generateMap({ seed });
    this.nodesById = new Map(
      this.map.nodes.map((node) => [node.id, node])
    );
  }

  regenerate({ seed } = {}) {
    this.map = generateMap({ seed });
    this.nodesById = new Map(
      this.map.nodes.map((node) => [node.id, node])
    );

    return this.map;
  }

  getMap() {
    return this.map;
  }

  getNodes() {
    return [...this.map.nodes];
  }

  getRows() {
    return this.map.rows.map((row) => [...row]);
  }

  getNodeById(nodeId) {
    return this.nodesById.get(nodeId) ?? null;
  }

  getCurrentNode() {
    return this.getNodeById(this.gameState.currentNodeId);
  }

  getAccessibleNodes() {
    const currentNode = this.getCurrentNode();

    if (currentNode === null) {
      return [];
    }

    return currentNode.nextNodeIds
      .map((nodeId) => this.getNodeById(nodeId))
      .filter((node) => node !== null);
  }

  isNodeAccessible(nodeId) {
    return this.getAccessibleNodes().some((node) => node.id === nodeId);
  }

  moveToNode(nodeId) {
    const targetNode = this.getNodeById(nodeId);

    if (targetNode === null || !this.isNodeAccessible(nodeId)) {
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
