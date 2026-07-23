"use strict";

import { getItemById, getRandomAvailableItem } from "../data/items.js";

export class EventResolver {
  constructor({ gameState, itemController = null, startEncounter = async () => {} }) {
    this.gameState = gameState;
    this.itemController = itemController;
    this.startEncounter = startEncounter;
  }

  async resolve(effect = {}) {
    switch (effect.type) {
      case "none": return { type: effect.type };
      case "gain-gold": this.gameState.addGold(effect.amount); return { type: effect.type, amount: effect.amount };
      case "lose-gold": return { type: effect.type, amount: this.gameState.loseGold(effect.amount) };
      case "gain-item": return this.gainItem(effect.itemId);
      case "random-item": return this.gainItem(getRandomAvailableItem(this.gameState.inventory)?.id ?? null);
      case "lose-random-item": return this.loseRandomItem();
      case "difficulty-shift": this.gameState.queueNextFunscriptDifficultyShift(effect.amount); return { type: effect.type, amount: effect.amount };
      case "arm-protection": this.gameState.armNextEncounterProtection(); return { type: effect.type };
      case "start-encounter": await this.startEncounter(effect.encounterId, effect.encounterType || "normal"); return { type: effect.type, encounterId: effect.encounterId };
      default: throw new Error(`Effet d’événement inconnu : ${effect.type}`);
    }
  }

  gainItem(itemId) {
    const item = getItemById(itemId);
    if (!item || !this.gameState.addItem(itemId)) return { type: "gain-item", itemId: null };
    this.itemController?.ensureRuntimeState(itemId);
    return { type: "gain-item", itemId };
  }

  loseRandomItem() {
    if (!this.gameState.inventory.length) return { type: "lose-item", itemId: null };
    const itemId = this.gameState.inventory[Math.floor(Math.random() * this.gameState.inventory.length)];
    this.gameState.removeItem(itemId);
    return { type: "lose-item", itemId };
  }
}
