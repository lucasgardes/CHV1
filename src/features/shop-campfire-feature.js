"use strict";

import { GameState, GAME_STATUS } from "../game/game-state.js";
import { MapController } from "../game/map/map-controller.js";
import { ItemController } from "../game/item-controller.js";
import { ITEMS, getItemById, getAvailableItems } from "../data/items.js";

const UPGRADE_DESCRIPTIONS = Object.freeze({
  "controlled-breath": "Réduit davantage l’intensité pendant la séquence.",
  "emergency-button": "Réduit la pénalité infligée après l’interruption.",
  "rhythm-analyzer": "Ajoute des zones visuelles calmes, moyennes et intenses.",
  "last-stand": "Accorde une courte pause avant la reprise.",
  "time-out": "Augmente la pause de 30 à 45 secondes."
});

const shopStateByNodeId = new Map();
let activeGameState = null;
let activeMapController = null;
let activeItemController = null;

function patchRuntimeAccess() {
  const originalReset = GameState.prototype.reset;
  GameState.prototype.reset = function patchedReset(...args) {
    const result = originalReset.apply(this, args);
    this.upgradedItemIds = [];
    return result;
  };

  GameState.prototype.isItemUpgraded = function isItemUpgraded(itemId) {
    return this.upgradedItemIds.includes(itemId);
  };

  GameState.prototype.upgradeItem = function upgradeItem(itemId) {
    if (!this.hasItem(itemId) || this.isItemUpgraded(itemId)) {
      return false;
    }

    if (!Object.hasOwn(UPGRADE_DESCRIPTIONS, itemId)) {
      return false;
    }

    this.upgradedItemIds.push(itemId);
    return true;
  };

  const originalStartRun = GameState.prototype.startRun;
  GameState.prototype.startRun = function patchedStartRun(...args) {
    const result = originalStartRun.apply(this, args);
    activeGameState = this;
    return result;
  };

  const originalGetMap = MapController.prototype.getMap;
  MapController.prototype.getMap = function patchedGetMap(...args) {
    activeMapController = this;
    return originalGetMap.apply(this, args);
  };

  const originalMoveToNode = MapController.prototype.moveToNode;
  MapController.prototype.moveToNode = function patchedMoveToNode(nodeId) {
    activeMapController = this;
    const node = originalMoveToNode.call(this, nodeId);

    if (node.type === "shop" || node.type === "campfire") {
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent("chv:room-selected", {
          detail: { node }
        }));
      });
    }

    return node;
  };

  const originalEnsureRuntimeState = ItemController.prototype.ensureRuntimeState;
  ItemController.prototype.ensureRuntimeState = function patchedEnsureRuntimeState(...args) {
    activeItemController = this;
    return originalEnsureRuntimeState.apply(this, args);
  };
}

function ensureStylesheet() {
  if (document.querySelector('link[data-room-styles="true"]')) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./shop-campfire.css";
  link.dataset.roomStyles = "true";
  document.head.append(link);
}

function getElement(id) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Élément introuvable : ${id}`);
  }
  return element;
}

function hideGameScreens() {
  for (const screen of document.querySelectorAll(".game-screen")) {
    screen.hidden = true;
  }
}

function updateResourceDisplay() {
  if (!activeGameState) return;

  const goldValue = document.getElementById("gold-value");
  const inventoryValue = document.getElementById("inventory-value");

  if (goldValue) {
    goldValue.textContent = String(activeGameState.gold);
  }

  if (inventoryValue) {
    inventoryValue.textContent = activeGameState.inventory.length === 0
      ? "Aucun"
      : activeGameState.inventory.map((itemId) => {
        const item = getItemById(itemId);
        const upgraded = activeGameState.isItemUpgraded(itemId);
        return `${item?.name ?? itemId}${upgraded ? " +" : ""}`;
      }).join(", ");
  }
}

function finishRoom(screen) {
  if (!activeGameState) return;

  activeGameState.completeCurrentNode();
  activeGameState.setStatus(GAME_STATUS.MAP);
  screen.hidden = true;
  getElement("map-screen").hidden = false;
  updateResourceDisplay();
}

function getInflationMultiplier(node) {
  const progress = Math.max(0, Math.min(1, node.row / 12));
  if (progress >= 2 / 3) return 1.2;
  if (progress >= 1 / 3) return 1.1;
  return 1;
}

function roundPrice(price) {
  return Math.round(price / 5) * 5;
}

function createStock(ownedItemIds, size = 3) {
  const available = [...getAvailableItems(ownedItemIds)];

  for (let index = available.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [available[index], available[randomIndex]] = [available[randomIndex], available[index]];
  }

  return available.slice(0, size).map((item) => item.id);
}

function getShopState(node) {
  if (!activeGameState) {
    throw new Error("État de partie indisponible.");
  }

  if (!shopStateByNodeId.has(node.id)) {
    shopStateByNodeId.set(node.id, {
      stock: createStock(activeGameState.inventory),
      rerollCount: 0
    });
  }

  return shopStateByNodeId.get(node.id);
}

function getRerollCost(rerollCount) {
  const costs = [25, 40, 60];
  return costs[rerollCount] ?? 60 + (rerollCount - 2) * 20;
}

function renderShop(node) {
  if (!activeGameState) return;

  const screen = getElement("shop-screen");
  const gold = getElement("shop-gold-value");
  const stockList = getElement("shop-stock-list");
  const rerollButton = getElement("shop-reroll-button");
  const state = getShopState(node);
  const multiplier = getInflationMultiplier(node);

  hideGameScreens();
  screen.hidden = false;
  gold.textContent = String(activeGameState.gold);
  stockList.replaceChildren();

  if (state.stock.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-empty-message";
    empty.textContent = "Aucun objet disponible.";
    stockList.append(empty);
  }

  for (const itemId of state.stock) {
    const item = getItemById(itemId);
    if (!item) continue;

    const price = roundPrice(item.price * multiplier);
    const card = document.createElement("article");
    card.className = "room-item-card";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const type = document.createElement("p");
    type.className = "room-item-type";
    type.textContent = item.type;

    const description = document.createElement("p");
    description.textContent = item.description;

    const buyButton = document.createElement("button");
    buyButton.type = "button";
    buyButton.textContent = `${price} or`;
    buyButton.disabled = activeGameState.gold < price;
    buyButton.addEventListener("click", () => {
      if (!activeGameState.spendGold(price)) return;
      if (!activeGameState.addItem(item.id)) {
        activeGameState.addGold(price);
        return;
      }

      state.stock = state.stock.filter((entry) => entry !== item.id);
      renderShop(node);
      updateResourceDisplay();
    });

    card.append(title, type, description, buyButton);
    stockList.append(card);
  }

  const rerollCost = getRerollCost(state.rerollCount);
  rerollButton.textContent = `Renouveler le stock — ${rerollCost} or`;
  rerollButton.disabled = activeGameState.gold < rerollCost;
  rerollButton.onclick = () => {
    if (!activeGameState.spendGold(rerollCost)) return;
    state.rerollCount += 1;
    state.stock = createStock(activeGameState.inventory);
    renderShop(node);
    updateResourceDisplay();
  };

  getElement("shop-leave-button").onclick = () => finishRoom(screen);
}

function getUpgradeableItems() {
  if (!activeGameState) return [];

  return activeGameState.inventory
    .map((itemId) => getItemById(itemId))
    .filter((item) => {
      return item !== null &&
        Object.hasOwn(UPGRADE_DESCRIPTIONS, item.id) &&
        !activeGameState.isItemUpgraded(item.id);
    });
}

function rechargeAllItems() {
  if (!activeGameState || !activeItemController) return;

  for (const itemId of activeGameState.inventory) {
    const item = getItemById(itemId);
    if (item?.type === "rechargeable") {
      activeItemController.recharge(itemId);
    }
  }
}

function renderCampfire(node) {
  if (!activeGameState) return;

  const screen = getElement("campfire-screen");
  const mainChoices = getElement("campfire-main-choices");
  const upgradeList = getElement("campfire-upgrade-list");
  const message = getElement("campfire-message");

  hideGameScreens();
  screen.hidden = false;
  mainChoices.hidden = false;
  upgradeList.hidden = true;
  message.textContent = "Choisis une seule action.";

  getElement("campfire-rest-button").onclick = () => {
    rechargeAllItems();
    message.textContent = "Tous les objets rechargeables ont été rechargés.";
    finishRoom(screen);
  };

  getElement("campfire-upgrade-button").onclick = () => {
    const items = getUpgradeableItems();
    mainChoices.hidden = true;
    upgradeList.hidden = false;
    upgradeList.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "room-empty-message";
      empty.textContent = "Aucun objet améliorable.";
      upgradeList.append(empty);

      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.textContent = "Retour";
      backButton.addEventListener("click", () => renderCampfire(node));
      upgradeList.append(backButton);
      return;
    }

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "room-item-card";

      const title = document.createElement("h3");
      title.textContent = `${item.name} +`;

      const description = document.createElement("p");
      description.textContent = UPGRADE_DESCRIPTIONS[item.id];

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Améliorer";
      button.addEventListener("click", () => {
        if (!activeGameState.upgradeItem(item.id)) return;
        message.textContent = `${item.name} a été amélioré.`;
        finishRoom(screen);
      });

      card.append(title, description, button);
      upgradeList.append(card);
    }
  };
}

function initializeFeature() {
  ensureStylesheet();

  window.addEventListener("chv:room-selected", (event) => {
    const node = event.detail?.node;
    if (!node) return;

    if (node.type === "shop") {
      renderShop(node);
    } else if (node.type === "campfire") {
      renderCampfire(node);
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    // Force la capture des instances lorsque les méthodes seront appelées.
    activeMapController?.getMap();
  }, { once: true });
}

patchRuntimeAccess();
initializeFeature();

export { UPGRADE_DESCRIPTIONS };
