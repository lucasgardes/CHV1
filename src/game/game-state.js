"use strict";

export const GAME_STATUS = Object.freeze({
  MENU: "menu",
  MAP: "map",
  ENCOUNTER: "encounter",
  REWARD: "reward",
  GAME_OVER: "game-over",
  VICTORY: "victory",
  EVENT: "event"
});

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.status = GAME_STATUS.MENU;
    this.gold = 50;
    this.inventory = [];
    this.currentNodeId = null;
    this.completedNodeIds = [];
    this.currentEncounter = null;
  }

  startRun(startNodeId = "start") {
    this.reset();
    this.status = GAME_STATUS.MAP;
    this.currentNodeId = startNodeId;
  }

  setStatus(status) {
    if (!Object.values(GAME_STATUS).includes(status)) {
      throw new Error(`Statut de partie invalide : ${status}`);
    }

    this.status = status;
  }

  setCurrentEncounter(encounter) {
    this.currentEncounter = encounter;
  }

  completeCurrentNode() {
    if (
      this.currentNodeId !== null &&
      !this.completedNodeIds.includes(this.currentNodeId)
    ) {
      this.completedNodeIds.push(this.currentNodeId);
    }
  }

  moveToNode(nodeId) {
    if (typeof nodeId !== "string" || nodeId.trim() === "") {
      throw new Error("L’identifiant de la case est invalide.");
    }

    this.currentNodeId = nodeId;
  }

  addGold(amount) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("La quantité d’or ajoutée est invalide.");
    }

    this.gold += amount;
  }

  spendGold(amount) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("La quantité d’or dépensée est invalide.");
    }

    if (this.gold < amount) {
      return false;
    }

    this.gold -= amount;
    return true;
  }

  hasItem(itemId) {
    return this.inventory.includes(itemId);
  }

  addItem(itemId) {
    if (this.hasItem(itemId)) {
      return false;
    }

    this.inventory.push(itemId);
    return true;
  }
}