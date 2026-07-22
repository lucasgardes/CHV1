"use strict";

import { GAME_STATUS } from "./game-state.js";
import { getAvailableItems, getItemById } from "../data/items.js";

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function roundPrice(price) {
  return Math.max(0, Math.round(price / 5) * 5);
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

  getOwnedValues(itemId) {
    if (!this.gameState.hasItem(itemId)) return null;
    return this.itemController.getEffectiveValues(itemId);
  }

  getInflationMultiplier() {
    const row = this.currentNode?.row ?? 0;
    const progress = Math.max(0, Math.min(1, row / 12));
    if (progress >= 2 / 3) return 1.2;
    if (progress >= 1 / 3) return 1.1;
    return 1;
  }

  getStockSize() {
    const values = this.getOwnedValues("privileged-stock");
    return 3 + Math.max(0, Number(values?.slots) || 0);
  }

  createStock(size = this.getStockSize()) {
    return shuffle(getAvailableItems(this.gameState.inventory))
      .slice(0, size)
      .map((entry) => entry.id);
  }

  getShopState() {
    const nodeId = this.currentNode.id;
    if (!this.shopStates.has(nodeId)) {
      this.shopStates.set(nodeId, {
        stock: this.createStock(),
        rerollCount: 0,
        purchaseCount: 0,
        loyaltyDiscount: 0
      });
    }
    return this.shopStates.get(nodeId);
  }

  getRerollCost(rerollCount) {
    const costs = [25, 40, 60];
    return costs[rerollCount] ?? 60 + (rerollCount - 2) * 20;
  }

  getShopDiscount(state) {
    const regular = Math.max(0, Number(this.getOwnedValues("shop-regular")?.discount) || 0);
    const faithful = this.getOwnedValues("faithful-customer");
    const faithfulDiscount = state.purchaseCount < (Number(faithful?.purchases) || 0)
      ? Math.max(0, Number(faithful?.discount) || 0)
      : 0;
    return Math.min(0.8, regular + faithfulDiscount + state.loyaltyDiscount);
  }

  getItemPrice(item, state = this.getShopState()) {
    const base = item.price * this.getInflationMultiplier();
    return roundPrice(base * (1 - this.getShopDiscount(state)));
  }

  renderShop() {
    const state = this.getShopState();
    const items = state.stock
      .map((itemId) => getItemById(itemId))
      .filter((entry) => entry !== null)
      .map((entry) => {
        const price = this.getItemPrice(entry, state);
        return { item: entry, price, affordable: this.gameState.gold >= price };
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
    if (item === null || !state.stock.includes(itemId)) return false;

    const price = this.getItemPrice(item, state);
    if (!this.gameState.spendGold(price)) return false;
    if (!this.gameState.addItem(item.id)) {
      this.gameState.addGold(price);
      return false;
    }

    state.stock = state.stock.filter((entry) => entry !== item.id);
    state.purchaseCount += 1;

    const loyalty = this.getOwnedValues("loyalty-program");
    if (loyalty) {
      const step = Math.max(0, Number(loyalty.discountPerPurchase) || 0);
      const maximum = Math.max(0, Number(loyalty.maxDiscount) || 0);
      state.loyaltyDiscount = Math.min(maximum, state.loyaltyDiscount + step);
    }

    this.renderShop();
    return true;
  }

  rerollShop() {
    const state = this.getShopState();
    const cost = this.getRerollCost(state.rerollCount);
    if (!this.gameState.spendGold(cost)) return false;
    state.rerollCount += 1;
    state.stock = this.createStock();
    this.renderShop();
    return true;
  }

  renderCampfire() {
    const upgradeableItems = this.gameState.inventory
      .map((itemId) => getItemById(itemId))
      .filter((entry) => entry !== null && entry.upgrade !== undefined && !this.gameState.isItemUpgraded(entry.id));
    this.campfireView.setUpgradeableItems(upgradeableItems);
    this.campfireView.show();
  }

  rest() {
    this.itemController.rechargeAll();
    this.completeRoom();
  }

  upgradeItem(itemId) {
    const item = getItemById(itemId);
    if (item === null || item.upgrade === undefined) return false;
    if (!this.gameState.upgradeItem(itemId)) return false;
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
