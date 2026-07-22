"use strict";

import { generateMap } from "./map-generator.js";

export class MapController {
  constructor({ gameState, seed } = {}) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.gameState = gameState;
    this.setMap(generateMap({ seed }));
  }

  setMap(map) {
    this.map = map;
    this.nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  }

  regenerate({ seed } = {}) {
    this.setMap(generateMap({ seed }));
    this.gameState.currentNodeId = this.map.startNodeId;
    this.gameState.completedNodeIds = [];
    return this.map;
  }

  getMap() {
    return this.map;
  }

  getNodes({ includeHidden = false } = {}) {
    return this.map.nodes.filter((node) => includeHidden || node.hidden !== true);
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
    const accessibleNodes = currentNode === null
      ? []
      : currentNode.nextNodeIds
        .map((nodeId) => this.getNodeById(nodeId))
        .filter((node) => node !== null && node.hidden !== true);

    Object.defineProperties(accessibleNodes, {
      mapRows: { value: this.getRows(), enumerable: false },
      mapNodes: { value: this.getNodes(), enumerable: false },
      mapSeed: { value: this.map.seed, enumerable: false },
      validation: { value: this.map.validation, enumerable: false }
    });

    return accessibleNodes;
  }

  isNodeAccessible(nodeId) {
    return this.getAccessibleNodes().some((node) => node.id === nodeId);
  }

  moveToNode(nodeId) {
    const targetNode = this.getNodeById(nodeId);
    if (targetNode === null || !this.isNodeAccessible(nodeId)) {
      throw new Error(`La case ${nodeId} n’est pas accessible.`);
    }

    const currentNode = this.getCurrentNode();
    if (currentNode !== null && currentNode.type === "start") {
      this.gameState.completeCurrentNode();
    }

    this.gameState.moveToNode(targetNode.id);
    return targetNode;
  }

  revealHiddenEncounter() {
    const hiddenConnection = this.map.hiddenConnection;
    if (!hiddenConnection) return null;

    const sourceNode = this.getNodeById(hiddenConnection.sourceNodeId);
    const hiddenNode = this.getNodeById(hiddenConnection.nodeId);
    if (!sourceNode || !hiddenNode) return null;

    hiddenNode.hidden = false;
    if (!sourceNode.nextNodeIds.includes(hiddenNode.id)) {
      sourceNode.nextNodeIds.push(hiddenNode.id);
    }
    return hiddenNode;
  }
}
