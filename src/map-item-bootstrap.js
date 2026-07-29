"use strict";

import "./event-ui-bootstrap.js";
import "./collection-ui-bootstrap.js";
import { getItemById, ITEM_TYPES } from "./data/items.js";
import { getGameRuntime } from "./game/runtime-access.js";
import { createItemVisual, getItemTypeLabel } from "./ui/item-visual.js";

const TYPE_CONFIG = Object.freeze([
  { type:ITEM_TYPES.CONSUMABLE, className:"consumables", title:"Consommables" },
  { type:ITEM_TYPES.RECHARGEABLE, className:"rechargeables", title:"Rechargeables" },
  { type:ITEM_TYPES.PASSIVE, className:"passives", title:"Passifs" }
]);

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

function effectiveDescription(item, upgraded) {
  if (!item) return "Description indisponible.";
  return upgraded && item.upgrade?.description ? item.upgrade.description : item.description;
}

function createDockItem(runtime, itemId) {
  const item = getItemById(itemId);
  const upgraded = runtime.gameState.isItemUpgraded(itemId);
  const wrapper = document.createElement("div");
  wrapper.className = "inventory-icon-entry";
  wrapper.tabIndex = 0;
  wrapper.dataset.itemId = itemId;
  wrapper.setAttribute("aria-label", `${item?.name ?? itemId} — ${effectiveDescription(item, upgraded)}`);
  wrapper.append(createItemVisual(item ?? { id:itemId }, { upgraded }));

  const tooltip = document.createElement("div");
  tooltip.className = "inventory-icon-tooltip";
  const type = document.createElement("span");
  type.className = "inventory-icon-tooltip__type";
  type.textContent = getItemTypeLabel(item?.type);
  const name = document.createElement("strong");
  name.textContent = `${item?.name ?? itemId}${upgraded ? " +" : ""}`;
  const description = document.createElement("p");
  description.textContent = effectiveDescription(item, upgraded);
  tooltip.append(type, name, description);
  wrapper.append(tooltip);
  return wrapper;
}

function createFullItemCard(runtime, itemId) {
  const item = getItemById(itemId);
  const upgraded = runtime.gameState.isItemUpgraded(itemId);
  const card = document.createElement("article");
  card.className = `inventory-library-card inventory-library-card--${item?.type ?? "unknown"}`;

  const visual = createItemVisual(item ?? { id:itemId }, { upgraded });
  const copy = document.createElement("div");
  copy.className = "inventory-library-card__copy";
  const eyebrow = document.createElement("p");
  eyebrow.className = "inventory-library-card__type";
  eyebrow.textContent = `${getItemTypeLabel(item?.type)}${upgraded ? " · Amélioré" : ""}`;
  const title = document.createElement("h3");
  title.textContent = item?.name ?? itemId;
  const description = document.createElement("p");
  description.className = "inventory-library-card__description";
  description.textContent = item?.description ?? "Description indisponible.";
  copy.append(eyebrow, title, description);

  if (upgraded && item?.upgrade?.description) {
    const upgrade = document.createElement("p");
    upgrade.className = "inventory-library-card__upgrade";
    upgrade.textContent = `Amélioration : ${item.upgrade.description}`;
    copy.append(upgrade);
  }

  card.append(visual, copy);
  return card;
}

function setupItemsScreen(runtime, refreshDock) {
  const navigation = document.querySelector(".main-navigation");
  const appShell = document.querySelector(".app-shell");
  if (!(navigation instanceof HTMLElement) || !(appShell instanceof HTMLElement)) return () => {};

  let tab = document.getElementById("items-navigation-tab");
  if (!(tab instanceof HTMLButtonElement)) {
    tab = document.createElement("button");
    tab.id = "items-navigation-tab";
    tab.className = "navigation-tab";
    tab.type = "button";
    tab.textContent = "Objets";
    const collectionTab = document.getElementById("collection-navigation-tab");
    navigation.insertBefore(tab, collectionTab ?? null);
  }

  let screen = document.getElementById("items-screen");
  if (!(screen instanceof HTMLElement)) {
    screen = document.createElement("section");
    screen.id = "items-screen";
    screen.className = "game-screen inventory-library-screen";
    screen.hidden = true;
    screen.innerHTML = `<div class="inventory-library-panel panel"><header class="inventory-library-header"><div><p class="screen-kicker">Inventaire de la partie</p><h1>Objets</h1><p class="inventory-library-summary"></p></div></header><div class="inventory-library-groups"></div></div>`;
    const firstScreen = appShell.querySelector(".game-screen");
    appShell.insertBefore(screen, firstScreen ?? null);
  }

  const render = () => {
    refreshDock();
    const groupsRoot = screen.querySelector(".inventory-library-groups");
    const summary = screen.querySelector(".inventory-library-summary");
    if (!(groupsRoot instanceof HTMLElement)) return;
    const inventory = [...runtime.gameState.inventory];
    if (summary) summary.textContent = `${inventory.length} objet${inventory.length > 1 ? "s" : ""} possédé${inventory.length > 1 ? "s" : ""}`;
    groupsRoot.replaceChildren();

    for (const config of TYPE_CONFIG) {
      const ids = inventory.filter((itemId) => getItemById(itemId)?.type === config.type);
      const section = document.createElement("section");
      section.className = `inventory-library-group inventory-library-group--${config.className}`;
      const header = document.createElement("header");
      const title = document.createElement("h2");
      title.textContent = config.title;
      const count = document.createElement("span");
      count.textContent = String(ids.length);
      header.append(title, count);
      const grid = document.createElement("div");
      grid.className = "inventory-library-grid";
      if (!ids.length) {
        const empty = document.createElement("p");
        empty.className = "inventory-library-empty";
        empty.textContent = "Aucun objet dans cette catégorie.";
        grid.append(empty);
      } else {
        for (const itemId of ids) grid.append(createFullItemCard(runtime, itemId));
      }
      section.append(header, grid);
      groupsRoot.append(section);
    }
  };

  tab.addEventListener("click", () => {
    document.querySelectorAll(".game-screen").forEach((candidate) => { candidate.hidden = candidate !== screen; });
    document.querySelectorAll(".navigation-tab").forEach((candidate) => candidate.classList.toggle("is-active", candidate === tab));
    render();
  });

  navigation.addEventListener("click", (event) => {
    const clicked = event.target instanceof Element ? event.target.closest(".navigation-tab") : null;
    if (clicked && clicked !== tab) screen.hidden = true;
  });

  return render;
}

function setupInventoryDock(runtime) {
  ensureStylesheet("./inventory-dock.css", "inventoryDockStyles");
  ensureStylesheet("./item-visuals.css", "itemVisualStyles");
  const mapScreen = document.getElementById("map-screen");
  const dock = mapScreen?.querySelector(".inventory-dock");
  const legacyInventory = document.getElementById("inventory-value");
  const legacySection = legacyInventory?.closest("section");
  if (!(dock instanceof HTMLElement)) return () => {};
  legacySection?.classList.add("legacy-inventory-section");
  dock.setAttribute("aria-label", "Inventaire actuel");
  const groups = new Map(TYPE_CONFIG.map(({ type, className }) => [type, dock.querySelector(`.inventory-group.${className}`)]));

  const refresh = () => {
    for (const [type, group] of groups) {
      if (!(group instanceof HTMLElement)) continue;
      const itemIds = runtime.gameState.inventory.filter((itemId) => getItemById(itemId)?.type === type);
      const count = group.querySelector("header span");
      if (count) count.textContent = String(itemIds.length);
      let list = group.querySelector(".inventory-item-list");
      if (!(list instanceof HTMLElement)) {
        list = document.createElement("div");
        list.className = "inventory-item-list";
        group.querySelector(".inventory-placeholder")?.replaceWith(list);
      }
      list.replaceChildren();
      if (!itemIds.length) {
        const empty = document.createElement("p");
        empty.className = "inventory-group-empty";
        empty.textContent = "Aucun";
        list.append(empty);
      } else {
        for (const itemId of itemIds) list.append(createDockItem(runtime, itemId));
      }
    }
  };

  if (legacyInventory) new MutationObserver(refresh).observe(legacyInventory, { childList:true, characterData:true, subtree:true });
  refresh();
  return refresh;
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
  cancelButton.addEventListener("click", () => { choicePanel.hidden = true; couponButton.hidden = false; choiceList.replaceChildren(); });
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
    if (!shouldShow) { couponButton.hidden = true; choicePanel.hidden = true; choiceList.replaceChildren(); return; }
    if (choicePanel.hidden) couponButton.hidden = false;
  };
  new MutationObserver(refreshVisibility).observe(shopScreen, { attributes:true, attributeFilter:["hidden"] });
  refreshVisibility();
}

function initialize(runtime) {
  const refreshDock = setupInventoryDock(runtime);
  setupItemsScreen(runtime, refreshDock);
  document.getElementById("map-item-actions")?.remove();
  const shopScreen = document.getElementById("shop-screen");
  const shopCard = shopScreen?.querySelector(".modal-card");
  if (shopScreen instanceof HTMLElement && shopCard instanceof HTMLElement) setupDubiousCoupon(shopScreen, shopCard);
}

window.addEventListener("DOMContentLoaded", waitForRuntime);
