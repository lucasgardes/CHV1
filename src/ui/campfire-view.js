"use strict";

export class CampfireView {
  constructor({ screen, message, mainChoices, upgradeList, restButton, upgradeButton, onRest, onUpgradeSelected }) {
    this.screen = screen;
    this.message = message;
    this.mainChoices = mainChoices;
    this.upgradeList = upgradeList;
    this.onRest = onRest;
    this.onUpgradeSelected = onUpgradeSelected;

    restButton.addEventListener("click", () => this.onRest());
    upgradeButton.addEventListener("click", () => {
      this.showUpgradeChoices();
    });
  }

  show() {
    for (const screen of document.querySelectorAll(".game-screen")) {
      screen.hidden = true;
    }

    this.screen.hidden = false;
    this.mainChoices.hidden = false;
    this.upgradeList.hidden = true;
    this.message.textContent = "Choisis une seule action.";
  }

  hide() {
    this.screen.hidden = true;
  }

  setUpgradeableItems(items) {
    this.upgradeableItems = items;
  }

  showUpgradeChoices() {
    const items = this.upgradeableItems ?? [];
    this.mainChoices.hidden = true;
    this.upgradeList.hidden = false;
    this.upgradeList.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "room-empty-message";
      empty.textContent = "Aucun objet améliorable.";

      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.textContent = "Retour";
      backButton.addEventListener("click", () => this.show());

      this.upgradeList.append(empty, backButton);
      return;
    }

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "room-item-card";

      const title = document.createElement("h3");
      title.textContent = `${item.name} +`;

      const description = document.createElement("p");
      description.textContent = item.upgrade.description;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Améliorer";
      button.addEventListener("click", () => this.onUpgradeSelected(item.id));

      card.append(title, description, button);
      this.upgradeList.append(card);
    }
  }
}
