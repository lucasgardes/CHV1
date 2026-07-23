"use strict";

import { getItemById } from "./data/items.js";
import { getGameRuntime } from "./game/runtime-access.js";
import { MapItemService } from "./game/map-item-service.js";

function waitForRuntime() {
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController) {
    window.setTimeout(waitForRuntime, 100);
    return;
  }
  initialize(runtime);
}

function renderMap(runtime) {
  runtime.mapView?.render({
    gameState: runtime.gameState,
    currentNode: runtime.mapController.getCurrentNode(),
    accessibleNodes: runtime.mapController.getAccessibleNodes()
  });
  runtime.runController?.syncMapDom();
}

function chooseNode(nodes, message) {
  if (!nodes.length) return null;
  const listing = nodes.map((node, index) => `${index + 1}. ${node.title} (${node.id})`).join("\n");
  const answer = window.prompt(`${message}\n\n${listing}`, "1");
  const index = Number(answer) - 1;
  return Number.isInteger(index) && nodes[index] ? nodes[index] : null;
}

function addActionButton(container, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button";
  button.textContent = label;
  button.addEventListener("click", () => {
    try { action(); }
    catch (error) { console.error(`Impossible d’utiliser ${label} :`, error); }
  });
  container.append(button);
}

function initialize(runtime) {
  const service = new MapItemService(runtime);
  const mapScreen = document.getElementById("map-screen");
  const detailSidebar = mapScreen?.querySelector(".detail-sidebar");
  if (detailSidebar) {
    const section = document.createElement("section");
    section.id = "map-item-actions";
    section.innerHTML = "<h3>Objets de carte</h3>";
    detailSidebar.insertBefore(section, detailSidebar.querySelector(".connection-card"));

    const refresh = () => {
      section.querySelectorAll("button").forEach((button) => button.remove());
      const state = runtime.gameState;
      const accessible = runtime.mapController.getAccessibleNodes();
      if (state.hasItem("detour-shoes")) addActionButton(section, "Chaussures de détour", () => {
        const current = runtime.mapController.getCurrentNode();
        const candidates = runtime.mapController.getMap().nodes.filter((node) => node.hidden !== true && node.row === (current?.row ?? 0) + 1 && !accessible.some((entry) => entry.id === node.id));
        const target = chooseNode(candidates, "Choisir une salle adjacente");
        if (target && service.useDetourShoes(target.id)) { renderMap(runtime); refresh(); }
      });
      if (state.hasItem("room-swap")) addActionButton(section, "Échange de salle", () => {
        const target = chooseNode(accessible.filter((node) => node.type === "normal"), "Choisir le round à remplacer");
        if (target && service.useRoomSwap(target.id)) { renderMap(runtime); refresh(); }
      });
      if (state.hasItem("spyglass")) addActionButton(section, "Longue-vue", () => { service.revealMysteries(); renderMap(runtime); refresh(); });
      if (state.hasItem("annotated-map")) addActionButton(section, "Carte annotée", () => { const details=service.annotateRoute(); window.alert(details.map((entry)=>`${entry.nodeId} — difficulté ${entry.difficulty ?? "?"}`).join("\n")||"Aucun round accessible."); refresh(); });
      if (state.hasItem("danger-detector")) addActionButton(section, "Détecteur de danger", () => { const details=service.detectDanger(); window.alert(details.map((entry)=>`${entry.nodeId} — heatmap révélée${entry.intensityStatsVisible?", statistiques visibles":""}`).join("\n")||"Aucun round accessible."); refresh(); });
      if (state.hasItem("reduced-difficulty")) addActionButton(section, "Difficulté réduite", () => { if(service.reduceNextElite()){renderMap(runtime);refresh();} });
    };
    new MutationObserver(() => { if (!mapScreen.hidden) refresh(); }).observe(mapScreen, { attributes:true, attributeFilter:["hidden"] });
    refresh();
  }

  const shopScreen = document.getElementById("shop-screen");
  const shopCard = shopScreen?.querySelector(".modal-card");
  if (shopCard) {
    const couponButton = document.createElement("button");
    couponButton.type = "button";
    couponButton.className = "secondary-button";
    couponButton.textContent = "Utiliser le Coupon douteux";
    couponButton.hidden = true;
    couponButton.addEventListener("click", () => {
      const controller = getGameRuntime().roomController;
      if (!controller) return;
      const choices = controller.useDubiousCoupon();
      if (!choices.length) return;
      const labels = choices.map((id,index)=>`${index+1}. ${getItemById(id)?.name ?? id}`).join("\n");
      const answer = Number(window.prompt(`Choisis l’objet gratuit :\n\n${labels}`, "1")) - 1;
      const itemId = choices[answer];
      if (itemId && controller.redeemDubiousCoupon(itemId)) couponButton.hidden = true;
    });
    shopCard.insertBefore(couponButton, document.getElementById("shop-leave-button"));
    new MutationObserver(() => {
      const state = getGameRuntime().gameState;
      couponButton.hidden = shopScreen.hidden || !state?.hasItem("dubious-coupon");
    }).observe(shopScreen, { attributes:true, attributeFilter:["hidden"] });
  }
}

window.addEventListener("DOMContentLoaded", waitForRuntime);
