"use strict";

export class MapItemService {
  constructor({ gameState, mapController, itemController }) {
    this.gameState = gameState;
    this.mapController = mapController;
    this.itemController = itemController;
  }

  consume(itemId) {
    if (!this.gameState.hasItem(itemId)) throw new Error(`Objet absent : ${itemId}`);
    this.gameState.removeItem(itemId);
  }

  getCurrentChoices() { return this.mapController.getAccessibleNodes(); }

  useDetourShoes(targetNodeId) {
    const current = this.mapController.getCurrentNode();
    const target = this.mapController.getNodeById(targetNodeId);
    if (!current || !target || Math.abs((target.row ?? 0) - (current.row ?? 0)) > 1) return false;
    if (target.hidden === true) return false;
    if (!current.nextNodeIds.includes(target.id)) current.nextNodeIds.push(target.id);
    this.consume("detour-shoes");
    return true;
  }

  useRoomSwap(targetNodeId) {
    const target = this.mapController.getNodeById(targetNodeId);
    const current = this.mapController.getCurrentNode();
    if (!target || !current || target.type !== "normal") return null;
    const alternatives = this.mapController.getMap().nodes.filter((node) => node.row === target.row && node.type === "normal" && node.id !== target.id);
    const replacement = alternatives[0] ?? null;
    if (!replacement) return null;
    const result = { originalNodeId: target.id, replacementNodeId: replacement.id, showDetails: this.gameState.isItemUpgraded("room-swap") };
    target.encounterId = replacement.encounterId;
    target.difficulty = replacement.difficulty;
    target.rewardGold = replacement.rewardGold;
    this.consume("room-swap");
    return result;
  }

  revealMysteries() {
    const depth = this.gameState.isItemUpgraded("spyglass") ? 2 : 1;
    const revealed = this.mapController.getAccessibleNodes().filter((node) => node.type === "event").slice(0, depth);
    for (const node of revealed) node.revealed = true;
    this.consume("spyglass");
    return revealed;
  }

  annotateRoute() {
    const count = 2;
    const details = this.mapController.getAccessibleNodes().filter((node) => ["normal", "elite", "boss"].includes(node.type)).slice(0, count).map((node) => ({
      nodeId: node.id,
      encounterId: node.encounterId,
      durationVisible: this.gameState.isItemUpgraded("annotated-map"),
      difficultyVisible: this.gameState.isItemUpgraded("annotated-map"),
      difficulty: node.difficulty
    }));
    this.consume("annotated-map");
    return details;
  }

  detectDanger() {
    const details = this.mapController.getAccessibleNodes().filter((node) => ["normal", "elite", "boss"].includes(node.type)).slice(0, 2).map((node) => ({
      nodeId: node.id,
      heatmapVisible: true,
      intensityStatsVisible: this.gameState.isItemUpgraded("danger-detector")
    }));
    this.consume("danger-detector");
    return details;
  }

  reduceNextElite() {
    const elite = this.mapController.getAccessibleNodes().find((node) => node.type === "elite");
    if (!elite) return false;
    elite.type = "normal";
    elite.title = "Rencontre normale";
    elite.rewardGold = Math.min(40, elite.rewardGold ?? 40);
    this.consume("reduced-difficulty");
    return true;
  }
}
