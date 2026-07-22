"use strict";

export class ActiveItemsView {
  constructor({
    activeItemStatus,
    activeItemList,
    onItemSelected
  }) {
    if (!(activeItemStatus instanceof HTMLElement)) {
      throw new Error(
        "Le statut des objets utilisables est invalide."
      );
    }

    if (!(activeItemList instanceof HTMLDivElement)) {
      throw new Error(
        "La liste des objets utilisables est invalide."
      );
    }

    if (typeof onItemSelected !== "function") {
      throw new Error(
        "onItemSelected doit être une fonction."
      );
    }

    this.activeItemStatus = activeItemStatus;
    this.activeItemList = activeItemList;
    this.onItemSelected = onItemSelected;
  }

  render({ status, items }) {
    this.activeItemStatus.textContent = status;
    this.activeItemList.replaceChildren();

    for (const item of items) {
      this.renderItem(item);
    }
  }

  renderItem(item) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "active-item-button";
    button.dataset.itemId = item.id;
    button.textContent = item.name;
    button.disabled = item.disabled === true;

    if (item.title) {
      button.title = item.title;
    }

    button.addEventListener("click", () => {
      this.onItemSelected(item.id);
    });

    this.activeItemList.append(button);
  }

  setStatus(message) {
    this.activeItemStatus.textContent = message;
  }

  disableAll() {
    for (const button of this.activeItemList.querySelectorAll("button")) {
      button.disabled = true;
    }
  }
}
