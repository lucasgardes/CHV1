"use strict";

export class ShopView {
  constructor({ screen, goldValue, stockList, rerollButton, leaveButton, onBuy, onReroll, onLeave }) {
    this.screen = screen;
    this.goldValue = goldValue;
    this.stockList = stockList;
    this.rerollButton = rerollButton;
    this.leaveButton = leaveButton;
    this.onBuy = onBuy;
    this.onReroll = onReroll;
    this.onLeave = onLeave;

    this.rerollButton.addEventListener("click", () => this.onReroll());
    this.leaveButton.addEventListener("click", () => this.onLeave());
  }

  show() {
    for (const screen of document.querySelectorAll(".game-screen")) {
      screen.hidden = true;
    }
    this.screen.hidden = false;
  }

  hide() {
    this.screen.hidden = true;
  }

  render({ gold, items, rerollCost }) {
    this.show();
    this.goldValue.textContent = String(gold);
    this.stockList.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "room-empty-message";
      empty.textContent = "Aucun objet disponible.";
      this.stockList.append(empty);
    }

    for (const entry of items) {
      const card = document.createElement("article");
      card.className = "room-item-card";

      const title = document.createElement("h3");
      title.textContent = entry.item.name;

      const type = document.createElement("p");
      type.className = "room-item-type";
      type.textContent = entry.item.type;

      const description = document.createElement("p");
      description.textContent = entry.item.description;

      const buyButton = document.createElement("button");
      buyButton.type = "button";
      buyButton.textContent = `${entry.price} or`;
      buyButton.disabled = !entry.affordable;
      buyButton.addEventListener("click", () => this.onBuy(entry.item.id));

      card.append(title, type, description, buyButton);
      this.stockList.append(card);
    }

    this.rerollButton.textContent = `Renouveler le stock — ${rerollCost} or`;
    this.rerollButton.disabled = gold < rerollCost;
  }
}
