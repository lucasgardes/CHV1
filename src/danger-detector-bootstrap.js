"use strict";

import { GAME_STATUS } from "./game/game-state.js";
import { getGameRuntime } from "./game/runtime-access.js";
import { loadFunscriptActions } from "./modules/funscript.js";

const VIDEO_NODE_TYPES = new Set(["normal", "elite", "boss", "hidden"]);
const HEATMAP_BINS = 28;
const PRESERVE_CHANCE = 0.25;

function ensureStyles() {
  if (document.querySelector('style[data-danger-detector-styles="true"]')) return;
  const style = document.createElement("style");
  style.dataset.dangerDetectorStyles = "true";
  style.textContent = `
    .danger-heatmap-strip{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);width:116px;height:16px;display:flex;align-items:flex-end;gap:1px;padding:2px 3px;border:1px solid rgba(255,255,255,.24);border-radius:5px;background:rgba(10,8,16,.9);box-shadow:0 5px 16px rgba(0,0,0,.38);pointer-events:none;z-index:5}
    .danger-heatmap-strip span{display:block;flex:1;min-width:1px;height:calc(2px + var(--heat)*11px);border-radius:1px;background:linear-gradient(180deg,#ffdf6c,#ef6b45 55%,#861f3b);opacity:calc(.42 + var(--heat)*.58)}
    .danger-heatmap-strip.is-unavailable{align-items:center;justify-content:center;color:#b9b1c5;font-size:8px;letter-spacing:.05em;text-transform:uppercase}
    .danger-detector-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:1000;max-width:min(680px,calc(100vw - 32px));padding:13px 18px;border:1px solid rgba(240,205,105,.38);border-radius:12px;background:rgba(20,15,27,.96);color:#f5edf7;box-shadow:0 18px 50px rgba(0,0,0,.5);font-weight:700;text-align:center}
  `;
  document.head.append(style);
}

function selectFunscriptPath(encounter, node) {
  const scripts = encounter?.funscripts;
  if (!scripts || typeof scripts !== "object") return null;
  const difficulty = node?.difficulty ?? encounter.selectedDifficulty ?? encounter.requestedDifficulty;
  return scripts[difficulty] ?? scripts.default ?? Object.values(scripts).find((value) => typeof value === "string") ?? null;
}

function calculateHeatmap(actions, durationSeconds) {
  if (!Array.isArray(actions) || actions.length < 2) return [];
  const durationMs = Math.max(Number(durationSeconds) * 1000 || 0, actions.at(-1)?.at || 1);
  const raw = Array(HEATMAP_BINS).fill(0);
  for (let index = 1; index < actions.length; index += 1) {
    const previous = actions[index - 1];
    const current = actions[index];
    const deltaTime = Math.max(1, current.at - previous.at);
    const movement = Math.abs(current.pos - previous.pos);
    const speed = movement / deltaTime * 1000;
    const bin = Math.min(HEATMAP_BINS - 1, Math.floor((current.at / durationMs) * HEATMAP_BINS));
    raw[bin] += speed;
  }
  const maximum = Math.max(...raw, 1);
  return raw.map((value) => Math.max(0.03, Math.min(1, value / maximum)));
}

function getStoredHeatmaps(gameState) {
  return gameState.getRunFlag?.("danger-detector-heatmaps") ?? {};
}

function storeHeatmaps(gameState, additions) {
  gameState.setRunFlag?.("danger-detector-heatmaps", { ...getStoredHeatmaps(gameState), ...additions });
}

function renderHeatmaps() {
  const runtime = getGameRuntime();
  const heatmaps = runtime.gameState ? getStoredHeatmaps(runtime.gameState) : {};
  const root = document.getElementById("map-node-list");
  if (!(root instanceof HTMLElement)) return;
  for (const button of root.querySelectorAll(".map-node-button")) {
    button.querySelector(".danger-heatmap-strip")?.remove();
    const entry = heatmaps[button.dataset.nodeId];
    if (!entry) continue;
    const strip = document.createElement("span");
    strip.className = "danger-heatmap-strip";
    strip.setAttribute("aria-hidden", "true");
    if (!entry.values?.length) {
      strip.classList.add("is-unavailable");
      strip.textContent = "indisponible";
    } else {
      for (const value of entry.values) {
        const bar = document.createElement("span");
        bar.style.setProperty("--heat", String(value));
        strip.append(bar);
      }
    }
    button.append(strip);
    const label = button.getAttribute("aria-label") || "Rencontre";
    button.setAttribute("aria-label", `${label}, heatmap du funscript révélée`);
  }
}

function showMessage(message) {
  document.querySelector(".danger-detector-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "danger-detector-toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
  const status = document.getElementById("video-status");
  if (status) status.textContent = message;
}

async function useDangerDetector(runtime) {
  const { gameState, mapController, encounterController } = runtime;
  if (gameState.status !== GAME_STATUS.MAP || !gameState.hasItem("danger-detector")) return false;
  if (typeof encounterController?.previewEncounterForNode !== "function") return false;

  const targets = mapController.getAccessibleNodes().filter((node) => VIDEO_NODE_TYPES.has(node.type) && node.encounterId);
  if (!targets.length) {
    showMessage("Détecteur de danger : aucun prochain round accessible.");
    return false;
  }

  const additions = {};
  for (const node of targets) {
    const encounter = encounterController.previewEncounterForNode(node);
    const funscriptPath = selectFunscriptPath(encounter, node);
    if (!funscriptPath) {
      additions[node.id] = { values:[], revealedAtNodeId:gameState.currentNodeId };
      continue;
    }
    try {
      const actions = await loadFunscriptActions(funscriptPath);
      additions[node.id] = {
        values:calculateHeatmap(actions, encounter?.durationSeconds),
        revealedAtNodeId:gameState.currentNodeId
      };
    } catch (error) {
      console.error(`Impossible de générer la heatmap pour ${node.id} :`, error);
      additions[node.id] = { values:[], revealedAtNodeId:gameState.currentNodeId };
    }
  }

  storeHeatmaps(gameState, additions);
  const upgraded = gameState.isItemUpgraded("danger-detector");
  const preserved = upgraded && Math.random() < PRESERVE_CHANCE;
  if (!preserved) gameState.removeItem("danger-detector");
  runtime.mapView?.render({
    gameState,
    currentNode:mapController.getCurrentNode(),
    accessibleNodes:mapController.getAccessibleNodes()
  });
  renderHeatmaps();
  showMessage(`Détecteur de danger : ${targets.length} heatmap${targets.length > 1 ? "s" : ""} révélée${targets.length > 1 ? "s" : ""}.${preserved ? " L’objet n’a pas été consommé." : ""}`);
  return true;
}

function initialize() {
  ensureStyles();
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.encounterController || !runtime.mapView) {
    window.setTimeout(initialize, 100);
    return;
  }
  const mapScreen = document.getElementById("map-screen");
  const mapRoot = document.getElementById("map-node-list");
  if (!(mapScreen instanceof HTMLElement) || !(mapRoot instanceof HTMLElement) || mapScreen.dataset.dangerDetectorReady === "true") return;
  mapScreen.dataset.dangerDetectorReady = "true";
  let busy = false;
  const activate = async (target) => {
    const entry = target instanceof Element ? target.closest('[data-item-id="danger-detector"]') : null;
    if (!(entry instanceof HTMLElement) || busy) return;
    busy = true;
    try { await useDangerDetector(getGameRuntime()); }
    finally { busy = false; }
  };
  mapScreen.addEventListener("click", (event) => void activate(event.target));
  mapScreen.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const entry = event.target instanceof Element ? event.target.closest('[data-item-id="danger-detector"]') : null;
    if (!(entry instanceof HTMLElement)) return;
    event.preventDefault();
    void activate(entry);
  });
  new MutationObserver(renderHeatmaps).observe(mapRoot, { childList:true, subtree:true });
  renderHeatmaps();
}

window.addEventListener("DOMContentLoaded", initialize);
