"use strict";

import { getItemById } from "../data/items.js";

export class ItemEffectService {
  constructor({ gameState, itemController, random = Math.random }) {
    if (!gameState || !itemController) throw new Error("Les services d’objets sont requis.");
    this.gameState = gameState;
    this.itemController = itemController;
    this.random = random;
  }

  values(itemId) {
    return this.gameState.hasItem(itemId) ? (this.itemController.getEffectiveValues(itemId) ?? {}) : null;
  }

  getEncounterModifiers(encounter) {
    const modifiers = {
      durationReductionSeconds: 0,
      durationExtraSeconds: 0,
      rewardMultiplier: 1,
      intensityMultiplier: 1,
      activeItemsDisabled: false,
      possessedBatteryTriggered: false,
      possessedBatteryGoldBonus: 0
    };

    const allDuration = this.values("golden-hourglass");
    if (allDuration) modifiers.durationReductionSeconds += Number(allDuration.seconds) || 0;

    const normalDuration = this.values("broken-watch");
    if (normalDuration && encounter.type === "normal") modifiers.durationReductionSeconds += Number(normalDuration.seconds) || 0;

    const eliteHunter = this.values("elite-hunter");
    if (eliteHunter && encounter.type === "elite") modifiers.durationReductionSeconds += Number(eliteHunter.seconds) || 0;

    const overconfidence = this.values("overconfidence");
    if (overconfidence) {
      if (encounter.type === "normal") modifiers.durationReductionSeconds += Number(overconfidence.normalReductionSeconds) || 0;
      if (encounter.type === "boss") modifiers.durationExtraSeconds += Number(overconfidence.bossExtraSeconds) || 0;
    }

    const clownBet = this.values("clown-bet");
    if (clownBet && encounter.type === "elite") {
      modifiers.durationExtraSeconds += Number(clownBet.extraSeconds) || 0;
      modifiers.rewardMultiplier *= Number(clownBet.rewardMultiplier) || 1;
    }

    const overheat = this.values("overheat-contract");
    if (overheat) {
      modifiers.intensityMultiplier *= Number(overheat.intensityMultiplier) || 1;
      modifiers.rewardMultiplier *= Number(overheat.goldMultiplier) || 1;
    }

    const radioSilence = this.values("radio-silence");
    if (radioSilence && this.random() < (Number(radioSilence.chance) || 0)) modifiers.activeItemsDisabled = true;

    const possessed = this.values("possessed-battery");
    if (possessed && this.random() < (Number(possessed.chance) || 0)) {
      modifiers.possessedBatteryTriggered = true;
      modifiers.intensityMultiplier *= Number(possessed.multiplier) || 1;
      modifiers.possessedBatteryGoldBonus = Number(possessed.goldBonus) || 0;
    }

    return modifiers;
  }

  applyMovementCost() {
    const wallet = this.values("leaky-wallet");
    if (!wallet) return 0;
    return this.gameState.loseGold(Math.max(0, Number(wallet.goldLossPerMove) || 0));
  }

  getRareItemBonus() {
    let bonus = 0;
    for (const itemId of ["lucky-coin", "cursed-token"]) {
      const values = this.values(itemId);
      if (values) bonus += Number(values.rareBonus) || 0;
    }
    return Math.max(0, bonus);
  }

  getShopSlotBonus() {
    return this.values("privileged-stock") ? 1 : 0;
  }

  getActiveItemCapacityBonus() {
    return Number(this.values("utility-belt")?.slots) || 0;
  }

  describeImplementedPassives() {
    return this.gameState.inventory.filter((itemId) => getItemById(itemId)?.type === "passive").map((itemId) => ({
      itemId,
      upgraded: this.gameState.isItemUpgraded(itemId),
      values: this.itemController.getEffectiveValues(itemId)
    }));
  }
}
