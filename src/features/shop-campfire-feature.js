"use strict";

import { getGameRuntime } from "../game/game-runtime.js";
import { RoomController } from "../game/room-controller.js";
import { ShopView } from "../ui/shop-view.js";
import { CampfireView } from "../ui/campfire-view.js";
import { getItemById } from "../data/items.js";

const IMPLEMENTED_ACTIVE_ITEMS = new Set([
  "time-out",
  "smoke-screen",
  "silencer",
  "cracked-stopwatch"
]);

function getElement(id, elementType = HTMLElement) {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`Élément introuvable ou invalide : ${id}`);
  }
  return element;
}

function updateResourceDisplay(gameState) {
  getElement("gold-value").textContent = String(gameState.gold);
  getElement("inventory-value").textContent = gameState.inventory.length === 0
    ? "Aucun"
    : gameState.inventory.map((itemId) => {
      const item = getItemById(itemId);
      return `${item?.name ?? itemId}${gameState.isItemUpgraded(itemId) ? " +" : ""}`;
    }).join(", ");
}

function showMap(gameState) {
  getElement("map-screen").hidden = false;
  updateResourceDisplay(gameState);
}

function wait(durationMilliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMilliseconds));
}

async function runCountdown(durationSeconds, onTick) {
  for (let remaining = durationSeconds; remaining > 0; remaining -= 1) {
    onTick(remaining);
    await wait(1000);
  }
  onTick(0);
}

function getRechargeLabel(itemController, itemId) {
  const state = itemController.getState(itemId);
  if (state.active) return "actif";
  if (state.available) return "disponible";
  const rounds = state.remainingRechargeRounds;
  return `recharge dans ${rounds} rencontre${rounds > 1 ? "s" : ""}`;
}

function installActiveItemHandlers(gameState, itemController) {
  const video = getElement("round-video", HTMLVideoElement);
  const status = getElement("active-item-status");
  const itemList = getElement("active-item-list", HTMLDivElement);
  let runningItemId = null;

  function refreshButtons() {
    for (const button of itemList.querySelectorAll("button[data-item-id]")) {
      const itemId = button.dataset.itemId;
      if (!IMPLEMENTED_ACTIVE_ITEMS.has(itemId)) continue;

      const item = getItemById(itemId);
      const state = itemController.getState(itemId);
      const upgraded = gameState.isItemUpgraded(itemId);
      const nextText = `${item?.name ?? itemId}${upgraded ? " +" : ""} — ${getRechargeLabel(itemController, itemId)}`;

      if (button.textContent !== nextText) {
        button.textContent = nextText;
      }

      button.disabled =
        gameState.status !== "encounter" ||
        video.paused ||
        video.ended ||
        !state.available ||
        state.active ||
        runningItemId !== null;
      button.title = state.available
        ? (item?.description ?? "")
        : `Recharge restante : ${state.remainingRechargeRounds} rencontre(s).`;
    }
  }

  async function usePauseItem(itemId) {
    const values = itemController.getEffectiveValues(itemId);
    const durationSeconds = Number(values?.durationSeconds) || 15;
    itemController.activate(itemId);
    itemController.consumeCharge(itemId);
    video.pause();

    await runCountdown(durationSeconds, (remaining) => {
      status.textContent = remaining > 0
        ? `${getItemById(itemId)?.name} actif : reprise dans ${remaining} seconde${remaining > 1 ? "s" : ""}.`
        : "Reprise de la vidéo...";
    });

    itemController.finishActivation(itemId);
    if (gameState.status === "encounter" && !video.ended) {
      await video.play();
    }
  }

  async function useSmokeScreen() {
    const itemId = "smoke-screen";
    const durationSeconds = Number(itemController.getEffectiveValues(itemId)?.durationSeconds) || 5;
    itemController.activate(itemId);
    itemController.consumeCharge(itemId);
    const previousOpacity = video.style.opacity;
    video.style.opacity = "0";

    await runCountdown(durationSeconds, (remaining) => {
      status.textContent = remaining > 0
        ? `Écran de fumée actif : ${remaining} seconde${remaining > 1 ? "s" : ""}.`
        : "Image restaurée.";
    });

    video.style.opacity = previousOpacity;
    itemController.finishActivation(itemId);
  }

  async function useSilencer() {
    const itemId = "silencer";
    const durationSeconds = Number(itemController.getEffectiveValues(itemId)?.durationSeconds) || 10;
    itemController.activate(itemId);
    itemController.consumeCharge(itemId);
    const previousMuted = video.muted;
    video.muted = true;

    await runCountdown(durationSeconds, (remaining) => {
      status.textContent = remaining > 0
        ? `Silencieux actif : ${remaining} seconde${remaining > 1 ? "s" : ""}.`
        : "Son restauré.";
    });

    video.muted = previousMuted;
    itemController.finishActivation(itemId);
  }

  itemList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-item-id]");
    if (!(button instanceof HTMLButtonElement)) return;

    const itemId = button.dataset.itemId;
    if (!IMPLEMENTED_ACTIVE_ITEMS.has(itemId)) return;

    const intercept = itemId !== "time-out" || gameState.isItemUpgraded("time-out");
    if (!intercept) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (
      runningItemId !== null ||
      gameState.status !== "encounter" ||
      video.paused ||
      video.ended ||
      !itemController.isAvailable(itemId)
    ) return;

    runningItemId = itemId;
    refreshButtons();

    void (async () => {
      try {
        if (itemId === "smoke-screen") {
          await useSmokeScreen();
        } else if (itemId === "silencer") {
          await useSilencer();
        } else {
          await usePauseItem(itemId);
        }
        status.textContent = `${getItemById(itemId)?.name} utilisé — ${getRechargeLabel(itemController, itemId)}.`;
      } catch (error) {
        console.error(`Impossible d’utiliser ${itemId} :`, error);
        itemController.finishActivation(itemId);
        video.style.opacity = "";
        video.muted = false;
        status.textContent = "Impossible d’utiliser cet objet.";
      } finally {
        runningItemId = null;
        refreshButtons();
      }
    })();
  }, true);

  const observer = new MutationObserver(refreshButtons);
  observer.observe(itemList, { childList: true });
  video.addEventListener("play", refreshButtons);
  video.addEventListener("pause", refreshButtons);
  video.addEventListener("ended", refreshButtons);
  window.addEventListener("chv:item-recharge-updated", refreshButtons);
  refreshButtons();
}

function initializeRooms() {
  const runtime = getGameRuntime();
  const { gameState, mapController, itemController } = runtime;

  if (!gameState || !mapController || !itemController) {
    throw new Error("Les contrôleurs principaux doivent être initialisés avant les salles.");
  }

  installActiveItemHandlers(gameState, itemController);
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
      window.dispatchEvent(new Event("chv:item-recharge-updated"));
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

  mapController.setRoomSelectionHandler((node) => roomController.open(node));
}

window.addEventListener("DOMContentLoaded", initializeRooms, { once: true });