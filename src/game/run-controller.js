"use strict";

import { getItemById } from "../data/items.js";
import { GAME_STATUS } from "./game-state.js";
import { registerRunController } from "./runtime-access.js";

export class RunController {
  constructor({ gameState, mapController, itemController, screenController, video = null, stopEncounter = async () => {}, onStatusChange = () => {} }) {
    if (!gameState || !mapController || !itemController || !screenController) throw new Error("Les services de partie sont requis.");
    this.gameState = gameState;
    this.mapController = mapController;
    this.itemController = itemController;
    this.screenController = screenController;
    this.video = video;
    this.stopEncounter = stopEncounter;
    this.onStatusChange = onStatusChange;
    registerRunController(this);
  }

  async stopCurrentEncounter() {
    if (this.video && typeof this.video.pause === "function") this.video.pause();
    await this.stopEncounter();
  }

  findPreviousNodeId() {
    const currentNode = this.mapController.getCurrentNode();
    if (!currentNode) return this.mapController.getMap().startNodeId;
    for (const nodeId of [...this.gameState.completedNodeIds].reverse()) {
      const node = this.mapController.getNodeById(nodeId);
      if (node?.nextNodeIds?.includes(currentNode.id)) return node.id;
    }
    return this.mapController.getMap().startNodeId;
  }

  returnToPreviousNode() {
    const nodeId = this.findPreviousNodeId();
    this.gameState.setCurrentEncounter(null);
    this.gameState.moveToNode(nodeId);
    this.gameState.setStatus(GAME_STATUS.MAP);
    this.syncMapDom();
    this.screenController.showMap();
    return nodeId;
  }

  startNewRun() {
    const startNodeId = this.mapController.getMap().startNodeId;
    this.gameState.startRun(startNodeId);
    this.itemController.resetForRun();
    this.syncMapDom();
    this.screenController.showMap();
    this.onStatusChange("Nouvelle partie commencée.");
    return { startNodeId };
  }

  async abortEncounterWithEmergencyButton(itemId = "emergency-button") {
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER) throw new Error("Aucune rencontre à interrompre.");
    const values = this.itemController.getEffectiveValues(itemId) ?? {};
    await this.stopCurrentEncounter();
    this.consumeConsumable(itemId);
    const penalty = Math.max(0, Math.round(25 * (Number(values.penaltyMultiplier) || 0)));
    const lostGold = this.gameState.loseGold(penalty);
    const returnNodeId = this.returnToPreviousNode();
    this.onStatusChange(`Bouton d’urgence activé : ${lostGold} or perdu.`);
    return { itemId, lostGold, returnNodeId };
  }

  armDelayedProtection(itemId = "delayed-protection") {
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER && this.gameState.status !== GAME_STATUS.MAP) throw new Error("La protection ne peut pas être préparée maintenant.");
    this.consumeConsumable(itemId);
    this.gameState.armNextEncounterProtection();
    this.onStatusChange("Protection différée armée pour la prochaine défaite en rencontre.");
    return { itemId, armed: true };
  }

  async leaveCurrentRoom(itemId = "exit-ticket") {
    if (![GAME_STATUS.ENCOUNTER, GAME_STATUS.EVENT].includes(this.gameState.status)) throw new Error("Aucune salle compatible à quitter.");
    const values = this.itemController.getEffectiveValues(itemId) ?? {};
    if (this.gameState.status === GAME_STATUS.ENCOUNTER) await this.stopCurrentEncounter();
    this.consumeConsumable(itemId);
    const lostGold = this.gameState.loseGold(Math.max(0, Number(values.penaltyGold) || 0));
    const returnNodeId = this.returnToPreviousNode();
    this.onStatusChange(`Ticket de sortie utilisé${lostGold ? ` : ${lostGold} or perdu` : ""}.`);
    return { itemId, lostGold, returnNodeId };
  }

  async skipNormalEncounter(itemId = "shortcut") {
    const node = this.mapController.getCurrentNode();
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER || node?.type !== "normal") throw new Error("Le raccourci ne fonctionne que pendant une rencontre normale.");
    const values = this.itemController.getEffectiveValues(itemId) ?? {};
    await this.stopCurrentEncounter();
    this.consumeConsumable(itemId);
    this.gameState.completeCurrentNode();
    this.gameState.setCurrentEncounter(null);
    this.gameState.setStatus(GAME_STATUS.MAP);
    const reward = Math.max(0, Math.round((Number(values.rewardMultiplier) || 0) * 20));
    if (reward) this.gameState.addGold(reward);
    this.syncMapDom();
    this.screenController.showMap();
    this.onStatusChange(`Raccourci utilisé${reward ? ` : +${reward} or` : " sans récompense"}.`);
    return { itemId, reward, nodeId: node.id };
  }

  escapeEvent(itemId = "escape-token") {
    if (this.gameState.status !== GAME_STATUS.EVENT) throw new Error("Aucun événement à fuir.");
    if (!this.itemController.isAvailable(itemId)) throw new Error("Le Jeton de fuite n’est pas disponible.");
    this.itemController.activate(itemId);
    this.itemController.consumeCharge(itemId);
    this.itemController.finishActivation(itemId);
    const returnNodeId = this.returnToPreviousNode();
    this.onStatusChange("Événement quitté grâce au Jeton de fuite.");
    return { itemId, returnNodeId };
  }

  consumeConsumable(itemId) {
    if (!this.gameState.hasItem(itemId)) throw new Error(`L’objet ${itemId} n’est pas possédé.`);
    const item = getItemById(itemId);
    if (item?.type !== "consumable") throw new Error(`L’objet ${itemId} n’est pas consommable.`);
    this.gameState.removeItem(itemId);
  }

  syncMapDom() {
    const gold = document.querySelector("#gold-value");
    const inventory = document.querySelector("#inventory-value");
    if (gold) gold.textContent = String(this.gameState.gold);
    if (inventory) inventory.textContent = this.gameState.inventory.length
      ? this.gameState.inventory.map((id) => getItemById(id)?.name ?? id).join(", ")
      : "Aucun";

    const accessibleIds = new Set(this.mapController.getAccessibleNodes().map((node) => node.id));
    for (const button of document.querySelectorAll("[data-node-id]")) {
      const id = button.dataset.nodeId;
      button.disabled = !accessibleIds.has(id);
      button.classList.toggle("is-current", id === this.gameState.currentNodeId);
      button.classList.toggle("is-accessible", accessibleIds.has(id));
      button.classList.toggle("is-completed", this.gameState.completedNodeIds.includes(id));
    }
  }
}
