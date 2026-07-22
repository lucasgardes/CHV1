"use strict";

import {
  GAME_STATUS
} from "./game-state.js";

import {
  getAvailableItems,
  getItemById
} from "../data/items.js";

function shuffle(values) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function roundPrice(price) {
  return Math.round(price / 5) * 5;
}

export class RoomController {
  constructor({ gameState, itemController, shopView, campfireView, onRoomCompleted }) {
    this.gameState = gameState;
    this.itemController = itemController;
    this.shopView = shopView;
    this.campfireView = campfireView;
    this.onRoomCompleted = onRoomCompleted;
    this.shopStates = new Map();
    this.currentNode = null;
  }

  open(node) {
    this.currentNode = node;

    if (node.type === "shop") {
      this.gameState.setStatus(GAME_STATUS.SHOP);
      this.renderShop();
      return;
    }

    if (node.type === "campfire") {
      this.gameState.setStatus(GAME_STATUS.CAMPFIRE);
      this.renderCampfire();
      return;
    }

    throw new Error(`Type de salle non pris en charge : ${node.type}`);
  }

  getInflationMultiplier() {
    const row = this.currentNode?.row ?? 0;
    const progress = Math.max(0, Math.min(1, row / 12));

    if (progress >= 2 / 3) return 1.2;
    if (progress >= 1 / 3) return 1.1;
    return 1;
  }

  createStock(size = 3) {
    return shuffle(getAvailableItems(this.gameState.inventory))
      .slice(0, size)
      .map((item) => item.id);
  }

  getShopState() {
    const nodeId = this.currentNode.id;

    if (!this.shopStates.has(nodeId)) {
      this.shopStates.set(nodeId, {
        stock: this.createStock(),
        rerollCount: 0
      });
    }

    return this.shopStates.get(nodeId);
  }

  getRerollCost(rerollCount) {
    const costs = [25, 40, 60];
    return costs[rerollCount] ?? 60 + (rerollCount - 2) * 20;
  }

  renderShop() {
    const state = this.getShopState();
    const multiplier = this.getInflationMultiplier();
    const items = state.stock
      .map((itemId) => getItemById(itemId))
      .filter((item) => item !== null)
      .map((item) => {
        const price = roundPrice(item.price * multiplier);
        return {
          item,
          price,
          affordable: this.gameState.gold >= price
        };
      });

    this.shopView.render({
      gold: this.gameState.gold,
      items,
      rerollCost: this.getRerollCost(state.rerollCount)
    });
  }

  buyItem(itemId) {
    const state = this.getShopState();
    const item = getItemById(itemId);

    if (item === null || !state.stock.includes(itemId)) {
      return false;
    }

    const price = roundPrice(item.price * this.getInflationMultiplier());

    if (!this.gameState.spendGold(price)) {
      return false;
    }

    if (!this.gameState.addItem(item.id)) {
      this.gameState.addGold(price);
      return false;
    }

    state.stock = state.stock.filter((entry) => entry !== item.id);
    this.renderShop();
    return true;
  }

  rerollShop() {
    const state = this.getShopState();
    const cost = this.getRerollCost(state.rerollCount);

    if (!this.gameState.spendGold(cost)) {
      return false;
    }

    state.rerollCount += 1;
    state.stock = this.createStock();
    this.renderShop();
    return true;
  }

  renderCampfire() {
    const upgradeableItems = this.gameState.inventory
      .map((itemId) => getItemById(itemId))
      .filter((item) => {
        return item !== null &&
          item.upgrade !== undefined &&
          !this.gameState.isItemUpgraded(item.id);
      });

    this.campfireView.setUpgradeableItems(upgradeableItems);
    this.campfireView.show();
  }

  rest() {
    this.itemController.rechargeAll();
    this.completeRoom();
  }

  upgradeItem(itemId) {
    const item = getItemById(itemId);

    if (item === null || item.upgrade === undefined) {
      return false;
    }

    if (!this.gameState.upgradeItem(itemId)) {
      return false;
    }

    this.completeRoom();
    return true;
  }

  completeRoom() {
    this.gameState.completeCurrentNode();
    this.gameState.setStatus(GAME_STATUS.MAP);
    this.shopView.hide();
    this.campfireView.hide();
    this.onRoomCompleted();
  }
}
