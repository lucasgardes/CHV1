"use strict";

export class MapView {
  constructor({
    mapNodeList,
    goldValue,
    inventoryValue,
    getItemById,
    onNodeSelected
  }) {
    if (!(mapNodeList instanceof HTMLDivElement)) {
      throw new Error(
        "La liste des cases de la carte est invalide."
      );
    }

    if (!(goldValue instanceof HTMLElement)) {
      throw new Error(
        "L’affichage de l’or est invalide."
      );
    }

    if (!(inventoryValue instanceof HTMLElement)) {
      throw new Error(
        "L’affichage de l’inventaire est invalide."
      );
    }

    if (typeof getItemById !== "function") {
      throw new Error(
        "getItemById doit être une fonction."
      );
    }

    if (typeof onNodeSelected !== "function") {
      throw new Error(
        "onNodeSelected doit être une fonction."
      );
    }

    this.mapNodeList = mapNodeList;
    this.goldValue = goldValue;
    this.inventoryValue = inventoryValue;
    this.getItemById = getItemById;
    this.onNodeSelected = onNodeSelected;
  }

  render({
    gameState,
    currentNode,
    accessibleNodes
  }) {
    this.mapNodeList.replaceChildren();

    this.renderGold(gameState.gold);
    this.renderInventory(gameState.inventory);

    if (currentNode === null) {
      this.renderError(
        "La case actuelle est introuvable."
      );

      return;
    }

    this.renderCurrentNode(currentNode);
    this.renderAccessibleNodes(accessibleNodes);
  }

  renderGold(gold) {
    this.goldValue.textContent =
      String(gold);
  }

  renderInventory(inventory) {
    if (!Array.isArray(inventory) || inventory.length === 0) {
      this.inventoryValue.textContent =
        "Aucun";

      return;
    }

    const itemNames = inventory.map((itemId) => {
      const item = this.getItemById(itemId);

      return item?.name ?? itemId;
    });

    this.inventoryValue.textContent =
      itemNames.join(", ");
  }

  renderCurrentNode(currentNode) {
    const currentNodeText =
      document.createElement("p");

    currentNodeText.className =
      "current-node-label";

    currentNodeText.textContent =
      `Position actuelle : ${currentNode.title}`;

    this.mapNodeList.append(
      currentNodeText
    );
  }

  renderAccessibleNodes(accessibleNodes) {
    for (const node of accessibleNodes) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        "map-node-button";

      button.dataset.nodeId =
        node.id;

      button.textContent =
        node.title;

      button.addEventListener(
        "click",
        () => {
          this.onNodeSelected(node.id);
        }
      );

      this.mapNodeList.append(
        button
      );
    }
  }

  renderError(message) {
    const errorText =
      document.createElement("p");

    errorText.className =
      "map-error-message";

    errorText.textContent =
      message;

    this.mapNodeList.append(
      errorText
    );
  }
}