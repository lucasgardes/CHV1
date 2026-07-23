"use strict";

import { getItemById } from "../data/items.js";
import { GAME_STATUS } from "./game-state.js";
import { registerRunController } from "./runtime-access.js";

export class RunController {
  constructor({ gameState, mapController, itemController, screenController, video = null, stopEncounter = async () => {}, onStatusChange = () => {}, random = Math.random }) {
    if (!gameState || !mapController || !itemController || !screenController) throw new Error("Les services de partie sont requis.");
    Object.assign(this, { gameState, mapController, itemController, screenController, video, stopEncounter, onStatusChange, random });
    registerRunController(this);
  }

  async stopCurrentEncounter() { if (this.video && typeof this.video.pause === "function") this.video.pause(); await this.stopEncounter(); }
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
    this.gameState.setCurrentEncounter(null); this.gameState.moveToNode(nodeId); this.gameState.setStatus(GAME_STATUS.MAP);
    this.syncMapDom(); this.screenController.showMap(); return nodeId;
  }
  startNewRun() {
    const startNodeId = this.mapController.getMap().startNodeId;
    this.gameState.startRun(startNodeId); this.itemController.resetForRun(); this.syncMapDom(); this.screenController.showMap();
    this.onStatusChange("Nouvelle partie commencée."); return { startNodeId };
  }

  async abortEncounterWithEmergencyButton(itemId = "emergency-button") {
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER) throw new Error("Aucune rencontre à interrompre.");
    const values = this.itemController.getEffectiveValues(itemId) ?? {};
    await this.stopCurrentEncounter(); this.consumeConsumable(itemId);
    const penalty = Math.max(0, Math.round(25 * (Number(values.penaltyMultiplier) || 0)));
    const lostGold = this.gameState.loseGold(penalty); const returnNodeId = this.returnToPreviousNode();
    this.onStatusChange(`Bouton d’urgence activé : ${lostGold} or perdu.`); return { itemId, lostGold, returnNodeId };
  }

  armDelayedProtection(itemId = "delayed-protection") {
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER && this.gameState.status !== GAME_STATUS.MAP) throw new Error("La protection ne peut pas être préparée maintenant.");
    const upgraded = this.gameState.isItemUpgraded(itemId);
    this.consumeConsumable(itemId);
    this.gameState.armNextEncounterProtection();
    this.gameState.setRunFlag?.("delayed-protection-reward-multiplier", upgraded ? 0.5 : 0);
    this.onStatusChange("Protection différée armée. Elle sera consommée même en cas de réussite.");
    return { itemId, armed:true, rewardMultiplier:upgraded ? 0.5 : 0 };
  }

  async leaveCurrentRoom(itemId = "exit-ticket") {
    if (![GAME_STATUS.ENCOUNTER, GAME_STATUS.EVENT].includes(this.gameState.status)) throw new Error("Aucune salle compatible à quitter.");
    if (this.gameState.status === GAME_STATUS.ENCOUNTER) await this.stopCurrentEncounter();
    this.consumeConsumable(itemId);
    const returnNodeId = this.returnToPreviousNode();
    this.onStatusChange("Ticket de sortie utilisé.");
    return { itemId, lostGold:0, returnNodeId };
  }

  shortenCurrentEncounter(itemId = "shortcut") {
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER || !this.video) throw new Error("Aucune rencontre à raccourcir.");
    const values = this.itemController.getEffectiveValues(itemId) ?? {};
    const seconds = Math.max(0, Number(values.seconds) || (this.gameState.isItemUpgraded(itemId) ? 45 : 30));
    const maximumTime = Number.isFinite(this.video.duration) ? Math.max(0, this.video.duration - 0.1) : this.video.currentTime + seconds;
    const previous = this.video.currentTime;
    this.video.currentTime = Math.min(maximumTime, previous + seconds);
    this.consumeConsumable(itemId);
    const skippedSeconds = Math.max(0, Math.round(this.video.currentTime - previous));
    this.onStatusChange(`Raccourci utilisé : ${skippedSeconds} secondes retirées.`);
    return { itemId, skippedSeconds };
  }

  async skipNormalEncounter(itemId = "shortcut-key") {
    const node = this.mapController.getCurrentNode();
    if (this.gameState.status !== GAME_STATUS.ENCOUNTER || node?.type !== "normal") throw new Error("La Clé du raccourci ne fonctionne que sur un round classique.");
    await this.stopCurrentEncounter(); this.consumeConsumable(itemId);
    this.gameState.completeCurrentNode(); this.gameState.setCurrentEncounter(null); this.gameState.setStatus(GAME_STATUS.MAP);
    this.gameState.queueNextFunscriptDifficultyShift(this.gameState.isItemUpgraded(itemId) ? 1 : 2);
    this.syncMapDom(); this.screenController.showMap();
    this.onStatusChange("Round ignoré. La prochaine rencontre sera plus difficile.");
    return { itemId, reward:0, nodeId:node.id };
  }

  escapeEvent(itemId = "escape-token") {
    if (this.gameState.status !== GAME_STATUS.EVENT) throw new Error("Aucun événement à fuir.");
    if (!this.itemController.isAvailable(itemId)) throw new Error("Le Jeton de fuite n’est pas disponible.");
    this.itemController.activate(itemId); this.itemController.consumeCharge(itemId); this.itemController.finishActivation(itemId);
    const returnNodeId = this.returnToPreviousNode(); this.onStatusChange("Événement quitté grâce au Jeton de fuite."); return { itemId, returnNodeId };
  }

  consumeConsumable(itemId) {
    if (!this.gameState.hasItem(itemId)) throw new Error(`L’objet ${itemId} n’est pas possédé.`);
    const item = getItemById(itemId);
    if (item?.type !== "consumable") throw new Error(`L’objet ${itemId} n’est pas consommable.`);
    const preserved = this.itemController.shouldPreserveConsumable(this.random);
    if (!preserved) this.gameState.removeItem(itemId);
    this.onStatusChange(preserved ? `${item.name} a été conservé grâce au Recycleur.` : `${item.name} a été consommé.`);
    return { itemId, preserved };
  }

  syncMapDom() {
    const gold = document.querySelector("#gold-value"); const inventory = document.querySelector("#inventory-value");
    if (gold) gold.textContent = String(this.gameState.gold);
    if (inventory) inventory.textContent = this.gameState.inventory.length ? this.gameState.inventory.map((id) => getItemById(id)?.name ?? id).join(", ") : "Aucun";
    const accessibleIds = new Set(this.mapController.getAccessibleNodes().map((node) => node.id));
    for (const button of document.querySelectorAll("[data-node-id]")) {
      const id = button.dataset.nodeId; button.disabled = !accessibleIds.has(id);
      button.classList.toggle("is-current", id === this.gameState.currentNodeId);
      button.classList.toggle("is-accessible", accessibleIds.has(id));
      button.classList.toggle("is-completed", this.gameState.completedNodeIds.includes(id));
    }
  }
}
