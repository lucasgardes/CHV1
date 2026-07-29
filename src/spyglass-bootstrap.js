"use strict";

import { getEventById } from "./data/events.js";
import { getItemValues } from "./data/items.js";
import { GAME_STATUS } from "./game/game-state.js";
import { getGameRuntime } from "./game/runtime-access.js";

const REVEAL_FLAG = "spyglass-mystery-reveals";

function ensureStyles() {
  if (document.querySelector('style[data-spyglass-styles="true"]')) return;
  const style = document.createElement("style");
  style.dataset.spyglassStyles = "true";
  style.textContent = `
    .spyglass-reveal-badge{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);z-index:6;min-width:112px;padding:3px 7px;border:1px solid rgba(107,211,198,.5);border-radius:999px;background:rgba(10,24,28,.94);color:#a9f2e8;font-size:9px;font-weight:800;letter-spacing:.04em;text-align:center;pointer-events:none;white-space:nowrap}
    .spyglass-preview{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid rgba(107,211,198,.26);border-radius:9px;background:rgba(19,45,48,.28)}
    .spyglass-preview strong{color:#baf5ed}
    .spyglass-preview ul{display:grid;gap:4px;margin:0;padding-left:18px;white-space:normal}
    .spyglass-preview .is-reward{color:#bce9b5}
    .spyglass-preview .is-penalty{color:#f0b3b3}
    .spyglass-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:1000;max-width:min(720px,calc(100vw - 32px));padding:13px 18px;border:1px solid rgba(107,211,198,.42);border-radius:12px;background:rgba(13,25,29,.97);color:#eefbf9;box-shadow:0 18px 50px rgba(0,0,0,.5);font-weight:700;text-align:center}
  `;
  document.head.append(style);
}

function amountText(effect) {
  if (Array.isArray(effect?.amountRange)) return `${effect.amountRange[0]} à ${effect.amountRange[1]}`;
  return Number.isFinite(effect?.amount) ? String(effect.amount) : null;
}

function classifyEffect(effect, output) {
  if (!effect || typeof effect !== "object") return;
  if (effect.type === "compound") {
    for (const child of effect.effects ?? []) classifyEffect(child, output);
    return;
  }
  if (effect.type === "random-outcome") {
    for (const child of effect.outcomes ?? []) classifyEffect(child, output);
    return;
  }
  if (effect.type === "nested-choice") {
    for (const choice of effect.choices ?? []) classifyEffect(choice.effect, output);
    return;
  }

  const amount = amountText(effect);
  switch (effect.type) {
    case "gain-gold": output.rewards.add(amount ? `Gain de ${amount} pièces d’or` : "Gain de pièces d’or"); break;
    case "lose-gold": output.penalties.add(amount ? `Perte de ${amount} pièces d’or` : "Perte de pièces d’or"); break;
    case "shop-price-multiplier":
      (Number(effect.multiplier) > 1 ? output.penalties : output.rewards).add(Number(effect.multiplier) > 1 ? "Prix de boutique augmentés" : "Prix de boutique réduits");
      break;
    case "three-lockers-security": output.rewards.add("Recharge accélérée des objets rechargeables"); break;
    case "reveal-next-encounters": output.rewards.add("Informations sur de prochaines rencontres"); break;
    case "choose-item-exchange": output.rewards.add("Possibilité d’obtenir un nouvel objet"); output.penalties.add("Perte possible d’un objet possédé"); break;
    case "elite-rare-bonus": output.rewards.add("Meilleure chance de récompense rare après un élite"); break;
    case "next-duration":
      (Number(effect.seconds) < 0 ? output.rewards : output.penalties).add(Number(effect.seconds) < 0 ? "Prochaine rencontre raccourcie" : "Prochaine rencontre allongée");
      break;
    case "next-intensity": output.penalties.add("Difficulté ou intensité d’une prochaine rencontre augmentée"); break;
    case "next-reward": {
      const positive = Number(effect.multiplier ?? 1) > 1 || Number(effect.goldFlat ?? 0) > 0;
      const negative = Number(effect.multiplier ?? 1) < 1 || Number(effect.goldFlat ?? 0) < 0;
      if (positive) output.rewards.add("Récompense d’une prochaine rencontre augmentée");
      if (negative) output.penalties.add("Récompense d’une prochaine rencontre réduite");
      break;
    }
    case "choose-owned-item":
      if (effect.selectedEffect) classifyEffect(effect.selectedEffect, output);
      for (const child of effect.afterEffects ?? []) classifyEffect(child, output);
      break;
    case "recharge-item": output.rewards.add("Recharge d’un objet rechargeable"); break;
    case "lose-item": output.penalties.add("Perte d’un objet possédé"); break;
    case "lose-random-item": output.penalties.add("Perte d’un objet aléatoire"); break;
    case "disable-item": output.penalties.add("Désactivation temporaire d’un objet"); break;
    case "disable-random-item-with-deferred-reward": output.penalties.add("Désactivation temporaire d’un objet"); output.rewards.add("Récompense différée en pièces d’or"); break;
    case "start-encounter": output.penalties.add("Rencontre vidéo supplémentaire"); break;
    case "hide-interface": output.penalties.add("Interface temporairement masquée"); break;
    case "none": output.neutral.add("Possibilité de repartir sans conséquence"); break;
    default: output.neutral.add("Conséquence spéciale inconnue");
  }
}

function summarizeEvent(event) {
  const output = { rewards:new Set(), penalties:new Set(), neutral:new Set() };
  for (const choice of event?.choices ?? []) classifyEffect(choice.effect, output);
  return {
    rewards:[...output.rewards],
    penalties:[...output.penalties],
    neutral:[...output.neutral]
  };
}

function findNextMysteryNode(mapController) {
  const current = mapController.getCurrentNode();
  if (!current) return null;
  const queue = current.nextNodeIds.map((id) => ({ id, distance:1 }));
  const visited = new Set([current.id]);
  let nearestDistance = Infinity;
  const candidates = [];

  while (queue.length) {
    const entry = queue.shift();
    if (visited.has(entry.id) || entry.distance > nearestDistance) continue;
    visited.add(entry.id);
    const node = mapController.getNodeById(entry.id);
    if (!node || node.hidden === true) continue;
    if (node.type === "event" && node.eventId) {
      nearestDistance = entry.distance;
      candidates.push(node);
      continue;
    }
    for (const nextId of node.nextNodeIds ?? []) queue.push({ id:nextId, distance:entry.distance + 1 });
  }

  return candidates.sort((left, right) => left.row - right.row || left.lane - right.lane || left.id.localeCompare(right.id))[0] ?? null;
}

function getReveals(gameState) {
  return gameState.getRunFlag?.(REVEAL_FLAG) ?? {};
}

function showMessage(message) {
  document.querySelector(".spyglass-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "spyglass-toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
  const status = document.getElementById("video-status");
  if (status) status.textContent = message;
}

function appendPreview(entry) {
  const copy = document.querySelector("#map-screen .detail-sidebar .detail-copy");
  if (!(copy instanceof HTMLElement)) return;
  copy.querySelector(".spyglass-preview")?.remove();
  if (!entry) return;
  const panel = document.createElement("section");
  panel.className = "spyglass-preview";
  const heading = document.createElement("strong");
  heading.textContent = "Longue-vue — conséquences possibles";
  const list = document.createElement("ul");
  for (const text of entry.rewards ?? []) { const li=document.createElement("li"); li.className="is-reward"; li.textContent=`Récompense : ${text}`; list.append(li); }
  for (const text of entry.penalties ?? []) { const li=document.createElement("li"); li.className="is-penalty"; li.textContent=`Malus : ${text}`; list.append(li); }
  for (const text of entry.neutral ?? []) { const li=document.createElement("li"); li.textContent=text; list.append(li); }
  panel.append(heading, list);
  copy.append(panel);
}

function renderReveals() {
  const runtime = getGameRuntime();
  if (!runtime.gameState) return;
  const reveals = getReveals(runtime.gameState);
  const root = document.getElementById("map-node-list");
  if (!(root instanceof HTMLElement)) return;
  for (const button of root.querySelectorAll(".map-node-button")) {
    button.querySelector(".spyglass-reveal-badge")?.remove();
    const entry = reveals[button.dataset.nodeId];
    if (!entry) continue;
    const badge = document.createElement("span");
    badge.className = "spyglass-reveal-badge";
    badge.textContent = "Conséquences révélées";
    button.append(badge);
    if (button.dataset.spyglassBound !== "true") {
      button.dataset.spyglassBound = "true";
      button.addEventListener("mouseenter", () => appendPreview(getReveals(getGameRuntime().gameState)[button.dataset.nodeId]));
      button.addEventListener("focus", () => appendPreview(getReveals(getGameRuntime().gameState)[button.dataset.nodeId]));
    }
  }
}

function useSpyglass(runtime) {
  const { gameState, mapController, mapView } = runtime;
  if (gameState.status !== GAME_STATUS.MAP || !gameState.hasItem("spyglass")) return false;
  const node = findNextMysteryNode(mapController);
  if (!node) {
    showMessage("Longue-vue : aucune prochaine case mystère accessible.");
    return false;
  }
  const event = getEventById(node.eventId);
  if (!event) return false;

  const reveals = { ...getReveals(gameState), [node.id]:{ nodeId:node.id, ...summarizeEvent(event), revealedAtNodeId:gameState.currentNodeId } };
  gameState.setRunFlag(REVEAL_FLAG, reveals);
  const values = getItemValues("spyglass", gameState.isItemUpgraded("spyglass")) ?? {};
  const preserved = Math.random() < Math.max(0, Math.min(1, Number(values.preserveChance) || 0));
  if (!preserved) gameState.removeItem("spyglass");

  mapView?.render({ gameState, currentNode:mapController.getCurrentNode(), accessibleNodes:mapController.getAccessibleNodes() });
  renderReveals();
  showMessage(`Longue-vue utilisée : récompenses et malus de la prochaine case mystère révélés.${preserved ? " L’objet n’a pas été consommé." : ""}`);
  return true;
}

function initialize() {
  ensureStyles();
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.mapView) { window.setTimeout(initialize, 100); return; }
  const mapScreen = document.getElementById("map-screen");
  const mapRoot = document.getElementById("map-node-list");
  if (!(mapScreen instanceof HTMLElement) || !(mapRoot instanceof HTMLElement) || mapScreen.dataset.spyglassReady === "true") return;
  mapScreen.dataset.spyglassReady = "true";
  mapScreen.addEventListener("click", (event) => {
    const entry = event.target instanceof Element ? event.target.closest('[data-item-id="spyglass"]') : null;
    if (entry instanceof HTMLElement) useSpyglass(getGameRuntime());
  });
  mapScreen.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const entry = event.target instanceof Element ? event.target.closest('[data-item-id="spyglass"]') : null;
    if (!(entry instanceof HTMLElement)) return;
    event.preventDefault();
    useSpyglass(getGameRuntime());
  });
  new MutationObserver(renderReveals).observe(mapRoot, { childList:true, subtree:true });
  renderReveals();
}

window.addEventListener("DOMContentLoaded", initialize);
