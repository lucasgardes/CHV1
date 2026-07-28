"use strict";

import "./event-ui-bootstrap.js";
import "./collection-ui-bootstrap.js";
import { getItemById, ITEM_TYPES } from "./data/items.js";
import { getGameRuntime } from "./game/runtime-access.js";
import { createItemVisual } from "./ui/item-visual.js";

function waitForRuntime() {
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController) { window.setTimeout(waitForRuntime, 100); return; }
  initialize(runtime);
}

function ensureStylesheet(href, marker) {
  if (document.querySelector(`link[data-${marker}="true"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset[marker] = "true";
  document.head.append(link);
}

function createInventoryCard(runtime, itemId) {
  const item = getItemById(itemId);
  const upgradedState = runtime.gameState.isItemUpgraded(itemId);
  const card = document.createElement("article");
  card.className = "inventory-item-card";
  card.dataset.itemId = itemId;
  const heading = document.createElement("div");
  heading.className = "inventory-item-heading";
  heading.append(createItemVisual(item ?? { id:itemId }, { upgraded: upgradedState, compact:true }));
  const name = document.createElement("strong");
  name.textContent = `${item?.name ?? itemId}${upgradedState ? " +" : ""}`;
  heading.append(name);
  if (upgradedState) { const upgraded = document.createElement("span"); upgraded.className = "inventory-upgraded-badge"; upgraded.textContent = "Amélioré"; heading.append(upgraded); }
  const description = document.createElement("p"); description.textContent = item?.description ?? "Description indisponible.";
  card.append(heading, description);
  return card;
}

function setupInventoryDock(runtime) {
  ensureStylesheet("./inventory-dock.css", "inventoryDockStyles");
  ensureStylesheet("./item-visuals.css", "itemVisualStyles");
  const mapScreen = document.getElementById("map-screen");
  const dock = mapScreen?.querySelector(".inventory-dock");
  const legacyInventory = document.getElementById("inventory-value");
  const legacySection = legacyInventory?.closest("section");
  if (!(dock instanceof HTMLElement)) return;
  legacySection?.classList.add("legacy-inventory-section");
  dock.setAttribute("aria-label", "Inventaire actuel");
  const groups = new Map([[ITEM_TYPES.CONSUMABLE,dock.querySelector(".inventory-group.consumables")],[ITEM_TYPES.RECHARGEABLE,dock.querySelector(".inventory-group.rechargeables")],[ITEM_TYPES.PASSIVE,dock.querySelector(".inventory-group.passives")]]);
  const refresh = () => {
    for (const [type, group] of groups) {
      if (!(group instanceof HTMLElement)) continue;
      const itemIds = runtime.gameState.inventory.filter((itemId) => getItemById(itemId)?.type === type);
      const count = group.querySelector("header span"); if (count) count.textContent = String(itemIds.length);
      let list = group.querySelector(".inventory-item-list");
      if (!(list instanceof HTMLElement)) { list = document.createElement("div"); list.className = "inventory-item-list"; group.querySelector(".inventory-placeholder")?.replaceWith(list); }
      list.replaceChildren();
      if (itemIds.length === 0) { const empty = document.createElement("p"); empty.className = "inventory-group-empty"; empty.textContent = "Aucun objet"; list.append(empty); continue; }
      for (const itemId of itemIds) list.append(createInventoryCard(runtime, itemId));
    }
  };
  if (legacyInventory) new MutationObserver(refresh).observe(legacyInventory,{childList:true,characterData:true,subtree:true});
  refresh();
}

function setupDubiousCoupon(shopScreen, shopCard) {
  const couponButton = document.createElement("button");
  couponButton.type = "button";
  couponButton.className = "secondary-button";
  couponButton.textContent = "Utiliser le Coupon douteux";
  couponButton.hidden = true;

  const choicePanel = document.createElement("section");
  choicePanel.className = "dubious-coupon-choice-panel";
  choicePanel.hidden = true;

  const title = document.createElement("p");
  title.className = "screen-description";
  title.textContent = "Choisis l’objet gratuit obtenu grâce au Coupon douteux.";

  const choiceList = document.createElement("div");
  choiceList.className = "choice-list dubious-coupon-choice-list";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button";
  cancelButton.textContent = "Annuler";
  cancelButton.addEventListener("click", () => {
    choicePanel.hidden = true;
    couponButton.hidden = false;
    choiceList.replaceChildren();
  });

  choicePanel.append(title, choiceList, cancelButton);

  couponButton.addEventListener("click", () => {
    const controller = getGameRuntime().roomController;
    if (!controller) return;
    const choices = controller.useDubiousCoupon();
    if (!Array.isArray(choices) || choices.length === 0) return;

    choiceList.replaceChildren();
    for (const itemId of choices) {
      const item = getItemById(itemId);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button dubious-coupon-choice";
      button.dataset.itemId = itemId;
      button.textContent = item?.name ?? itemId;
      button.title = item?.description ?? "Objet gratuit";
      button.addEventListener("click", () => {
        if (!controller.redeemDubiousCoupon(itemId)) return;
        choicePanel.hidden = true;
        choiceList.replaceChildren();
        couponButton.hidden = true;
      });
      choiceList.append(button);
    }

    couponButton.hidden = true;
    choicePanel.hidden = false;
  });

  const leaveButton = document.getElementById("shop-leave-button");
  shopCard.insertBefore(couponButton, leaveButton);
  shopCard.insertBefore(choicePanel, leaveButton);

  const refreshVisibility = () => {
    const state = getGameRuntime().gameState;
    const shouldShow = !shopScreen.hidden && Boolean(state?.hasItem("dubious-coupon"));
    if (!shouldShow) {
      couponButton.hidden = true;
      choicePanel.hidden = true;
      choiceList.replaceChildren();
      return;
    }
    if (choicePanel.hidden) couponButton.hidden = false;
  };

  new MutationObserver(refreshVisibility).observe(shopScreen, { attributes:true, attributeFilter:["hidden"] });
  refreshVisibility();
}

function initialize(runtime) {
  setupInventoryDock(runtime);
  document.getElementById("map-item-actions")?.remove();
  const shopScreen = document.getElementById("shop-screen");
  const shopCard = shopScreen?.querySelector(".modal-card");
  if (shopScreen instanceof HTMLElement && shopCard instanceof HTMLElement) setupDubiousCoupon(shopScreen, shopCard);
}

window.addEventListener("DOMContentLoaded", waitForRuntime);
