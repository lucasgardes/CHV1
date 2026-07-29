"use strict";

import { getBlessingById } from "./data/blessings.js";
import { getGameRuntime } from "./game/runtime-access.js";

const LOWER_DIFFICULTY = Object.freeze({ hard:"normal", normal:"easy", easy:"warmup" });

function deterministicRoll(nodeId) {
  let hash = 2166136261;
  for (const character of String(nodeId)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function applyPeacefulRoute(gameState, nodes) {
  if (gameState?.activeBlessingId !== "peaceful-route" || !Array.isArray(nodes)) return;
  const chance = Math.max(0, Math.min(1, Number(getBlessingById("peaceful-route")?.effect?.chance) || 0));
  for (const node of nodes) {
    if (node?.type !== "normal" || node.peacefulRouteResolved === true) continue;
    node.peacefulRouteResolved = true;
    const loweredDifficulty = LOWER_DIFFICULTY[node.difficulty];
    if (!loweredDifficulty || deterministicRoll(node.id) >= chance) continue;
    node.originalDifficulty = node.difficulty;
    node.difficulty = loweredDifficulty;
    node.peacefulRouteApplied = true;
  }
}

function ensureStyles() {
  if (document.querySelector('style[data-peaceful-route-styles="true"]')) return;
  const style = document.createElement("style");
  style.dataset.peacefulRouteStyles = "true";
  style.textContent = `
    .map-node-button.is-peaceful-route{box-shadow:0 0 0 5px rgba(117,223,152,.16),0 0 26px rgba(117,223,152,.62)}
    .map-node-button.is-peaceful-route.is-accessible{border-color:#75df98}
    .map-node-peaceful-route{position:absolute;right:-8px;top:-8px;display:grid;place-items:center;width:25px;height:25px;border:2px solid #b8f4ca;border-radius:50%;background:#183322;color:#b8f4ca;font-size:14px;font-weight:900;box-shadow:0 0 14px rgba(117,223,152,.8);pointer-events:none}
  `;
  document.head.append(style);
}

function decorateAppliedNodes(nodes) {
  for (const node of nodes ?? []) {
    if (!node?.peacefulRouteApplied) continue;
    const button = document.querySelector(`.map-node-button[data-node-id="${CSS.escape(node.id)}"]`);
    if (!(button instanceof HTMLButtonElement)) continue;
    button.classList.add("is-peaceful-route");
    const currentLabel = button.getAttribute("aria-label") ?? node.title ?? "Rencontre";
    if (!currentLabel.includes("Route apaisée")) button.setAttribute("aria-label", `${currentLabel}, Route apaisée activée`);
    if (button.querySelector(".map-node-peaceful-route")) continue;
    const marker = document.createElement("span");
    marker.className = "map-node-peaceful-route";
    marker.textContent = "✦";
    marker.title = "Route apaisée a réduit la difficulté de cette rencontre.";
    marker.setAttribute("aria-hidden", "true");
    button.append(marker);
  }
}

function initialize() {
  const runtime = getGameRuntime();
  if (!runtime.mapView || !runtime.gameState) {
    window.setTimeout(initialize, 100);
    return;
  }
  if (runtime.mapView.__peacefulRouteConnected) return;
  runtime.mapView.__peacefulRouteConnected = true;
  ensureStyles();
  const originalRender = runtime.mapView.render.bind(runtime.mapView);
  runtime.mapView.render = (model) => {
    const nodes = model?.accessibleNodes?.mapNodes ?? [];
    applyPeacefulRoute(model?.gameState, nodes);
    const result = originalRender(model);
    decorateAppliedNodes(nodes);
    return result;
  };
}

window.addEventListener("DOMContentLoaded", initialize);
