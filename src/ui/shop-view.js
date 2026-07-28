"use strict";

import { createItemVisual, getItemTypeLabel } from "./item-visual.js";
import { getGameRuntime } from "../game/runtime-access.js";
import { getBlessingById } from "../data/blessings.js";

const RARITY_LABELS = Object.freeze({ common: "Commun", rare: "Rare", cursed: "Maudit" });

function ensureShopStylesheet() {
  if (document.querySelector('link[data-shop-ui-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./shop-ui.css";
  link.dataset.shopUiStyles = "true";
  document.head.append(link);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPercent(multiplier) {
  return `${Math.round((Number(multiplier) - 1) * 100)} %`;
}

export class ShopView {
  constructor({ screen, goldValue, stockList, rerollButton, leaveButton, onBuy, onReroll, onLeave }) {
    ensureShopStylesheet();
    Object.assign(this, { screen, goldValue, stockList, rerollButton, leaveButton, onBuy, onReroll, onLeave });
    this.rerollButton.addEventListener("click", () => this.onReroll());
    this.leaveButton.addEventListener("click", () => this.onLeave());
    this.decorateShopShell();
  }

  decorateShopShell() {
    const card = this.screen?.querySelector(".modal-card");
    if (!(card instanceof HTMLElement) || card.querySelector(".shop-terminal-header")) return;
    card.classList.add("shop-terminal-card");
    const header = createElement("section", "shop-terminal-header");
    header.append(
      createElement("div", "shop-terminal-avatar", "▦"),
      createElement("div", "shop-terminal-copy")
    );
    const copy = header.lastElementChild;
    copy.append(
      createElement("strong", "shop-terminal-name", "UNITÉ D’APPROVISIONNEMENT 04"),
      createElement("span", "shop-terminal-status", "Canal clandestin actif — transactions anonymisées")
    );
    const title = card.querySelector("h2");
    card.insertBefore(header, title?.nextSibling ?? card.firstChild);
  }

  show() {
    for (const screen of document.querySelectorAll(".game-screen")) screen.hidden = true;
    this.screen.hidden = false;
  }

  hide() { this.screen.hidden = true; }

  render({ gold, items, rerollCost, stockCapacity = items.length, purchaseCount = 0 }) {
    this.show();
    this.goldValue.textContent = String(gold);
    this.stockList.replaceChildren();
    this.stockList.classList.add("shop-stock-grid");
    this.renderBlessingCalculationNotice();

    if (items.length === 0 && stockCapacity === 0) {
      const empty = createElement("p", "room-empty-message", "Aucun objet disponible.");
      this.stockList.append(empty);
    }

    for (const entry of items) this.stockList.append(this.createItemCard(entry));

    const emptySlots = Math.max(0, Number(stockCapacity) - items.length);
    for (let index = 0; index < emptySlots; index += 1) {
      const empty = createElement("article", "room-item-card shop-item-card shop-item-card--empty");
      empty.append(
        createElement("span", "shop-empty-slot__symbol", "∅"),
        createElement("strong", "shop-empty-slot__title", "Emplacement vide"),
        createElement("p", "shop-empty-slot__copy", purchaseCount > 0 ? "Objet déjà acheté dans cette boutique." : "Aucun article disponible pour cet emplacement.")
      );
      this.stockList.append(empty);
    }

    const activeBlessingId = getGameRuntime().gameState?.activeBlessingId;
    const freeByBlessing = rerollCost === 0 && activeBlessingId === "generous-hand";
    this.rerollButton.textContent = freeByBlessing ? "Renouveler le stock — gratuit grâce à Main généreuse" : rerollCost === 0 ? "Renouveler le stock — gratuit" : `Renouveler le stock — ${rerollCost} or`;
    this.rerollButton.disabled = gold < rerollCost;
    this.rerollButton.classList.toggle("is-unaffordable", gold < rerollCost);
  }

  renderBlessingCalculationNotice() {
    const card = this.screen?.querySelector(".modal-card");
    if (!(card instanceof HTMLElement)) return;
    card.querySelector(".shop-blessing-calculation")?.remove();
    const blessing = getBlessingById(getGameRuntime().gameState?.activeBlessingId);
    if (!blessing || !["merchant-favor", "generous-hand"].includes(blessing.id)) return;
    const notice = createElement("p", "shop-blessing-calculation", `✦ ${blessing.name} est prise en compte dans les calculs de cette boutique.`);
    const toolbar = card.querySelector(".room-toolbar");
    toolbar?.insertAdjacentElement("afterend", notice);
  }

  createItemCard(entry) {
    const { item, price, affordable, priceBreakdown = {} } = entry;
    const rarity = item.rarity ?? "common";
    const card = createElement("article", `room-item-card shop-item-card shop-item-card--${rarity}${affordable ? "" : " is-unaffordable"}`);
    card.dataset.itemId = item.id;

    const rarityBadge = createElement("span", `shop-rarity-badge shop-rarity-badge--${rarity}`, RARITY_LABELS[rarity] ?? rarity);
    const heading = createElement("div", "item-card-heading shop-item-heading");
    const visual = createItemVisual(item);
    visual.classList.add("shop-item-visual");
    const copy = createElement("div", "item-card-heading__copy");
    copy.append(
      createElement("h3", "shop-item-name", item.name),
      createElement("p", "room-item-type", getItemTypeLabel(item.type))
    );
    heading.append(visual, copy);

    const description = createElement("p", "shop-item-description", item.description);
    const breakdown = this.createPriceBreakdown(priceBreakdown, price);
    const buyButton = createElement("button", "shop-buy-button", affordable ? `Acheter — ${price} or` : `Or insuffisant — ${price} or`);
    buyButton.type = "button";
    buyButton.disabled = !affordable;
    buyButton.addEventListener("click", () => this.purchase(card, item.id));

    card.append(rarityBadge, heading, description, breakdown, buyButton);
    return card;
  }

  createPriceBreakdown(details, finalPrice) {
    const panel = createElement("dl", "shop-price-breakdown");
    const addRow = (label, value, className = "") => {
      const row = createElement("div", `shop-price-row ${className}`.trim());
      row.append(createElement("dt", "", label), createElement("dd", "", value));
      panel.append(row);
    };

    const basePrice = Number(details.basePrice ?? finalPrice);
    const inflationMultiplier = Number(details.inflationMultiplier ?? 1);
    const eventMultiplier = Number(details.eventMultiplier ?? 1);
    const discount = Number(details.discount ?? 0);
    const activeBlessingId = getGameRuntime().gameState?.activeBlessingId;
    const blessingDiscount = activeBlessingId === "merchant-favor" ? Math.min(.1, discount) : 0;
    const otherDiscount = Math.max(0, discount - blessingDiscount);
    const adjusted = inflationMultiplier !== 1 || eventMultiplier !== 1;
    const discounted = discount > 0;

    addRow("Prix de base", `${basePrice} or`, adjusted || discounted ? "is-reference" : "");
    if (inflationMultiplier !== 1) addRow("Inflation", `+${formatPercent(inflationMultiplier)}`, "is-increase");
    if (eventMultiplier !== 1) addRow("Modificateur d’événement", `${formatPercent(eventMultiplier)}`, eventMultiplier > 1 ? "is-increase" : "is-discount");
    if (blessingDiscount > 0) addRow("Bénédiction · Faveur des marchands", `−${Math.round(blessingDiscount * 100)} %`, "is-discount is-blessing");
    if (otherDiscount > 0) addRow("Autres réductions", `−${Math.round(otherDiscount * 100)} %`, "is-discount");
    addRow("Prix final", `${finalPrice} or`, "is-final");
    return panel;
  }

  purchase(card, itemId) {
    if (!(card instanceof HTMLElement) || card.classList.contains("is-purchasing")) return;
    card.classList.add("is-purchasing");
    for (const button of this.stockList.querySelectorAll("button")) button.disabled = true;
    window.setTimeout(() => this.onBuy(itemId), 360);
  }
}