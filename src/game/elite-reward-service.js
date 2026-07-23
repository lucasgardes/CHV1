"use strict";

import { getAvailableItems, getItemValues, ITEM_RARITIES } from "../data/items.js";

const GOLD_RANGES = Object.freeze({
  easy: [50, 65],
  normal: [55, 75],
  hard: [70, 90]
});

function randomInt([minimum, maximum], random) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function inferDifficulty(encounter = {}) {
  const value = Number(encounter.difficulty) || 2;
  if (value <= 1) return "easy";
  if (value >= 3) return "hard";
  return "normal";
}

function weightedItem(items, rareChance, random) {
  const rare = items.filter((item) => item.rarity === ITEM_RARITIES.RARE);
  const standard = items.filter((item) => item.rarity !== ITEM_RARITIES.RARE && item.rarity !== ITEM_RARITIES.CURSED);
  const cursed = items.filter((item) => item.rarity === ITEM_RARITIES.CURSED);
  if (rare.length && random() < rareChance) return rare[Math.floor(random() * rare.length)];
  const pool = standard.length ? standard : (rare.length ? rare : cursed);
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

export class EliteRewardService {
  constructor({ gameState, itemController = null, random = Math.random }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.gameState = gameState;
    this.itemController = itemController;
    this.random = random;
  }

  getRareChance(encounter) {
    const difficulty = inferDifficulty(encounter);
    const difficultyBonus = difficulty === "hard" ? 0.12 : difficulty === "normal" ? 0.05 : 0;
    const lucky = this.gameState.hasItem("lucky-coin") ? Number(getItemValues("lucky-coin", this.gameState.isItemUpgraded("lucky-coin"))?.rareBonus) || 0 : 0;
    const cursed = this.gameState.hasItem("cursed-token") ? Number(getItemValues("cursed-token", this.gameState.isItemUpgraded("cursed-token"))?.rareBonus) || 0 : 0;
    const eventBonus = this.gameState.consumeNextEliteRareChanceBonus?.() ?? 0;
    return Math.min(0.75, 0.05 + difficultyBonus + lucky + cursed + eventBonus);
  }

  getGoldMultiplier() {
    if (!this.gameState.hasItem("clown-bet")) return 1;
    return Number(getItemValues("clown-bet", this.gameState.isItemUpgraded("clown-bet"))?.rewardMultiplier) || 2;
  }

  createGoldReward(encounter) {
    const difficulty = inferDifficulty(encounter);
    const base = randomInt(GOLD_RANGES[difficulty], this.random);
    return { type: "gold", amount: Math.round(base * this.getGoldMultiplier()) };
  }

  createItemReward(ownedItemIds, rareChance) {
    const item = weightedItem(getAvailableItems(ownedItemIds), rareChance, this.random);
    return item ? { type: "item", itemId: item.id, item } : null;
  }

  createBundle(encounter = {}) {
    const firstElite = (this.gameState.elitesDefeated ?? 0) === 0;
    const rareChance = this.getRareChance(encounter);
    const rewards = [];
    const reservedIds = [...this.gameState.inventory];

    const addItem = () => {
      const reward = this.createItemReward(reservedIds, rareChance);
      if (!reward) return false;
      rewards.push(reward);
      reservedIds.push(reward.itemId);
      return true;
    };

    if (firstElite) addItem();
    while (rewards.length < 2) {
      const itemChance = firstElite ? 0.35 : 0.45;
      if (this.random() < itemChance && addItem()) continue;
      rewards.push(this.createGoldReward(encounter));
    }

    return { rewards, firstElite, rareChance, encounterDifficulty: inferDifficulty(encounter) };
  }

  applyBundle(bundle) {
    const applied = [];
    for (const reward of bundle?.rewards ?? []) {
      if (reward.type === "gold") {
        this.gameState.addGold(reward.amount);
        applied.push(reward);
        continue;
      }
      if (reward.type === "item" && this.gameState.addItem(reward.itemId)) {
        this.itemController?.ensureRuntimeState(reward.itemId);
        applied.push(reward);
      }
    }
    this.gameState.elitesDefeated = (this.gameState.elitesDefeated ?? 0) + 1;
    return applied;
  }
}
