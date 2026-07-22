"use strict";

import "./room-dom.js";

import {
  getGameRuntime
} from "../game/game-runtime.js";

import {
  RoomController
} from "../game/room-controller.js";

import {
  ShopView
} from "../ui/shop-view.js";

import {
  CampfireView
} from "../ui/campfire-view.js";

import {
  getItemById
} from "../data/items.js";

function getElement(id, elementType = HTMLElement) {
  const element = document.getElementById(id);

  if (!(element instanceof elementType)) {
    throw new Error(`Élément introuvable ou invalide : ${id}`);
  }

  return element;
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

function updateResourceDisplay(gameState) {
  getElement("gold-value").textContent = String(gameState.gold);

  getElement("inventory-value").textContent =
    gameState.inventory.length === 0
      ? "Aucun"
      : gameState.inventory.map((itemId) => {
        const item = getItemById(itemId);
        const suffix = gameState.isItemUpgraded(itemId) ? " +" : "";
        return `${item?.name ?? itemId}${suffix}`;
      }).join(", ");
}

function showMap(gameState) {
  getElement("map-screen").hidden = false;
  updateResourceDisplay(gameState);
}

function installTimeOutUpgradeExtension() {
  const video = getElement("round-video", HTMLVideoElement);
  const status = getElement("active-item-status");
  let pendingExtraSeconds = 0;
  let applyingExtension = false;

  window.addEventListener("chv:time-out-extra", (event) => {
    pendingExtraSeconds = Math.max(
      0,
      Number(event.detail?.extraSeconds) || 0
    );
  });

  video.addEventListener("play", () => {
    if (pendingExtraSeconds <= 0 || applyingExtension) {
      return;
    }

    const extraSeconds = pendingExtraSeconds;
    pendingExtraSeconds = 0;
    applyingExtension = true;
    video.pause();

    let remaining = extraSeconds;
    status.textContent =
      `Temps mort + actif : ${remaining} secondes supplémentaires.`;

    const timer = window.setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        status.textContent =
          `Temps mort + actif : ${remaining} seconde${remaining > 1 ? "s" : ""} supplémentaire${remaining > 1 ? "s" : ""}.`;
        return;
      }

      window.clearInterval(timer);
      applyingExtension = false;
      status.textContent = "Reprise de la vidéo...";
      void video.play();
    }, 1000);
  });
}

function initializeRooms() {
  ensureStylesheet();
  installTimeOutUpgradeExtension();

  const runtime = getGameRuntime();
  const { gameState, itemController } = runtime;

  if (!gameState || !runtime.mapController || !itemController) {
    throw new Error(
      "Les contrôleurs principaux doivent être initialisés avant les salles."
    );
  }

  let roomController = null;

  const shopView = new ShopView({
    screen: getElement("shop-screen"),
    goldValue: getElement("shop-gold-value"),
    stockList: getElement("shop-stock-list", HTMLDivElement),
    rerollButton: getElement("shop-reroll-button", HTMLButtonElement),
    leaveButton: getElement("shop-leave-button", HTMLButtonElement),
    onBuy(itemId) {
      roomController.buyItem(itemId);
      updateResourceDisplay(gameState);
    },
    onReroll() {
      roomController.rerollShop();
      updateResourceDisplay(gameState);
    },
    onLeave() {
      roomController.completeRoom();
    }
  });

  const campfireView = new CampfireView({
    screen: getElement("campfire-screen"),
    message: getElement("campfire-message"),
    mainChoices: getElement("campfire-main-choices"),
    upgradeList: getElement("campfire-upgrade-list"),
    restButton: getElement("campfire-rest-button", HTMLButtonElement),
    upgradeButton: getElement("campfire-upgrade-button", HTMLButtonElement),
    onRest() {
      roomController.rest();
    },
    onUpgradeSelected(itemId) {
      roomController.upgradeItem(itemId);
      updateResourceDisplay(gameState);
    }
  });

  roomController = new RoomController({
    gameState,
    itemController,
    shopView,
    campfireView,
    onRoomCompleted() {
      showMap(gameState);
    }
  });

  window.addEventListener("chv:room-selected", (event) => {
    const node = event.detail?.node;

    if (node) {
      roomController.open(node);
    }
  });
}

window.addEventListener("DOMContentLoaded", initializeRooms, {
  once: true
});
