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

function wait(durationMilliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMilliseconds);
  });
}

async function runCountdown(durationSeconds, onTick) {
  for (
    let remainingSeconds = durationSeconds;
    remainingSeconds > 0;
    remainingSeconds -= 1
  ) {
    onTick(remainingSeconds);
    await wait(1000);
  }

  onTick(0);
}

function installUpgradedTimeOutHandler(gameState, itemController) {
  const video = getElement("round-video", HTMLVideoElement);
  const status = getElement("active-item-status");
  const itemList = getElement("active-item-list", HTMLDivElement);
  let running = false;

  itemList.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest('button[data-item-id="time-out"]');

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (!gameState.isItemUpgraded("time-out")) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (
      running ||
      gameState.status !== "encounter" ||
      video.paused ||
      video.ended ||
      !itemController.isAvailable("time-out")
    ) {
      return;
    }

    running = true;
    button.disabled = true;

    void (async () => {
      try {
        const values = itemController.getEffectiveValues("time-out");
        const durationSeconds = values?.durationSeconds ?? 45;

        itemController.activate("time-out");
        itemController.consumeCharge("time-out");
        video.pause();

        await runCountdown(durationSeconds, (remainingSeconds) => {
          status.textContent = remainingSeconds > 0
            ? `Temps mort + actif : reprise dans ${remainingSeconds} seconde${remainingSeconds > 1 ? "s" : ""}.`
            : "Reprise de la vidéo...";
        });

        itemController.finishActivation("time-out");

        if (gameState.status === "encounter" && !video.ended) {
          await video.play();
          status.textContent =
            "Temps mort + utilisé. Recharge au prochain round.";
        }
      } catch (error) {
        console.error("Impossible d’utiliser Temps mort + :", error);
        itemController.finishActivation("time-out");
        status.textContent = "Impossible d’utiliser Temps mort +.";
      } finally {
        running = false;
      }
    })();
  }, true);
}

function initializeRooms() {
  ensureStylesheet();

  const runtime = getGameRuntime();
  const { gameState, itemController } = runtime;

  if (!gameState || !runtime.mapController || !itemController) {
    throw new Error(
      "Les contrôleurs principaux doivent être initialisés avant les salles."
    );
  }

  installUpgradedTimeOutHandler(gameState, itemController);

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
