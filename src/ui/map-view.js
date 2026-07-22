"use strict";

const MAP_WIDTH = 720;
const LANE_X = Object.freeze([140, 360, 580]);
const ROW_GAP = 130;
const MAP_PADDING = 70;
const NODE_SIZE = 78;

const NODE_SYMBOLS = Object.freeze({
  start: "D",
  normal: "N",
  event: "?",
  elite: "E",
  boss: "B"
});

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

    const rows = accessibleNodes.mapRows;
    const nodes = accessibleNodes.mapNodes;

    if (!Array.isArray(rows) || !Array.isArray(nodes)) {
      this.renderError(
        "Les données complètes de la carte sont indisponibles."
      );
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "map-scroll-area";

    const map = document.createElement("div");
    map.className = "map-graph";
    map.style.width = `${MAP_WIDTH}px`;
    map.style.height = `${this.getMapHeight(rows.length)}px`;

    const nodePositions = this.createNodePositions(rows);
    const svg = this.renderConnections({
      nodes,
      nodePositions,
      gameState,
      accessibleNodes
    });

    map.append(svg);

    for (const node of nodes) {
      const position = nodePositions.get(node.id);

      if (position !== undefined) {
        map.append(
          this.createNodeButton({
            node,
            position,
            currentNode,
            accessibleNodes,
            completedNodeIds: gameState.completedNodeIds
          })
        );
      }
    }

    wrapper.append(map);
    this.mapNodeList.append(wrapper);

    window.requestAnimationFrame(() => {
      this.scrollToCurrentNode(wrapper, currentNode.id);
    });
  }

  getMapHeight(rowCount) {
    return MAP_PADDING * 2 + Math.max(0, rowCount - 1) * ROW_GAP;
  }

  createNodePositions(rows) {
    const positions = new Map();
    const lastRowIndex = rows.length - 1;

    for (const row of rows) {
      for (const node of row) {
        const visualRow = lastRowIndex - node.row;

        positions.set(node.id, {
          x: LANE_X[node.lane],
          y: MAP_PADDING + visualRow * ROW_GAP
        });
      }
    }

    return positions;
  }

  renderConnections({
    nodes,
    nodePositions,
    gameState,
    accessibleNodes
  }) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    const accessibleIds = new Set(
      accessibleNodes.map((node) => node.id)
    );
    const completedIds = new Set(gameState.completedNodeIds);

    svg.classList.add("map-connections");
    svg.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${this.getMapHeight(
      Math.max(...nodes.map((node) => node.row)) + 1
    )}`);
    svg.setAttribute("aria-hidden", "true");

    for (const node of nodes) {
      const source = nodePositions.get(node.id);

      if (source === undefined) {
        continue;
      }

      for (const targetId of node.nextNodeIds) {
        const target = nodePositions.get(targetId);

        if (target === undefined) {
          continue;
        }

        const line = document.createElementNS(svgNamespace, "line");
        const isCompletedPath = completedIds.has(node.id);
        const isAvailablePath =
          node.id === gameState.currentNodeId &&
          accessibleIds.has(targetId);

        line.setAttribute("x1", String(source.x));
        line.setAttribute("y1", String(source.y));
        line.setAttribute("x2", String(target.x));
        line.setAttribute("y2", String(target.y));
        line.classList.add("map-connection");

        if (isCompletedPath) {
          line.classList.add("is-completed");
        }

        if (isAvailablePath) {
          line.classList.add("is-accessible");
        }

        svg.append(line);
      }
    }

    return svg;
  }

  createNodeButton({
    node,
    position,
    currentNode,
    accessibleNodes,
    completedNodeIds
  }) {
    const accessibleIds = new Set(
      accessibleNodes.map((accessibleNode) => accessibleNode.id)
    );
    const isCurrent = node.id === currentNode.id;
    const isAccessible = accessibleIds.has(node.id);
    const isCompleted = completedNodeIds.includes(node.id);

    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "map-node-button",
      `map-node-${node.type}`,
      isCurrent ? "is-current" : "",
      isAccessible ? "is-accessible" : "",
      isCompleted ? "is-completed" : ""
    ].filter(Boolean).join(" ");

    button.dataset.nodeId = node.id;
    button.dataset.nodeType = node.type;
    button.style.left = `${position.x}px`;
    button.style.top = `${position.y}px`;
    button.disabled = !isAccessible;
    button.setAttribute(
      "aria-label",
      `${node.title}${isCurrent ? ", position actuelle" : ""}`
    );

    const symbol = document.createElement("span");
    symbol.className = "map-node-symbol";
    symbol.textContent = NODE_SYMBOLS[node.type] ?? "•";

    const label = document.createElement("span");
    label.className = "map-node-label";
    label.textContent = node.title;

    button.append(symbol, label);

    if (isAccessible) {
      button.addEventListener("click", () => {
        this.onNodeSelected(node.id);
      });
    }

    return button;
  }

  scrollToCurrentNode(wrapper, currentNodeId) {
    const currentButton = wrapper.querySelector(
      `[data-node-id="${CSS.escape(currentNodeId)}"]`
    );

    if (!(currentButton instanceof HTMLElement)) {
      return;
    }

    const targetScrollTop =
      currentButton.offsetTop -
      wrapper.clientHeight / 2 +
      currentButton.offsetHeight / 2;

    wrapper.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth"
    });
  }

  renderGold(gold) {
    this.goldValue.textContent = String(gold);
  }

  renderInventory(inventory) {
    if (!Array.isArray(inventory) || inventory.length === 0) {
      this.inventoryValue.textContent = "Aucun";
      return;
    }

    const itemNames = inventory.map((itemId) => {
      const item = this.getItemById(itemId);
      return item?.name ?? itemId;
    });

    this.inventoryValue.textContent = itemNames.join(", ");
  }

  renderError(message) {
    const errorText = document.createElement("p");
    errorText.className = "map-error-message";
    errorText.textContent = message;
    this.mapNodeList.append(errorText);
  }
}
