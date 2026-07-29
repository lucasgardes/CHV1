"use strict";

import { getGameRuntime } from "./game/runtime-access.js";

async function readJson(url, label) {
  try {
    const response = await fetch(url, { cache:"no-store" });
    return await response.json();
  } catch (error) {
    throw new Error(`${label} est introuvable ou invalide.`, { cause:error });
  }
}

function createLongBossEncounter(baseEncounter, metadata, videoUrl, funscriptUrl, metadataUrl) {
  return {
    ...baseEncounter,
    title:String(metadata?.title ?? baseEncounter.title ?? "Boss final"),
    type:"boss",
    videoPath:videoUrl,
    funscripts:{ boss:funscriptUrl, default:funscriptUrl },
    funscriptPath:funscriptUrl,
    defaultFunscriptDifficulty:"boss",
    requestedDifficulty:"boss",
    selectedDifficulty:"boss",
    difficulty:"boss",
    durationSeconds:Math.max(0, Number(metadata?.durationSeconds) || Number(baseEncounter.durationSeconds) + 45 || 0),
    themes:Array.isArray(metadata?.themes) ? [...metadata.themes] : [...(baseEncounter.themes ?? [])],
    performers:Array.isArray(metadata?.performers) ? [...metadata.performers] : [...(baseEncounter.performers ?? [])],
    metadataPath:metadataUrl,
    temporalDebtVariant:true,
    temporalDebtAddedSeconds:45
  };
}

async function buildLongBossVariant(baseEncounter) {
  if (!baseEncounter?.videoPath) throw new Error("Dette temporelle : le boss sélectionné ne possède aucun chemin vidéo.");
  const metadataUrl = new URL("metadata45.json", baseEncounter.videoPath).href;
  const videoUrl = new URL("video45.mp4", baseEncounter.videoPath).href;
  const funscriptUrl = new URL("default45.funscript", baseEncounter.videoPath).href;
  const [metadata, funscript] = await Promise.all([
    readJson(metadataUrl, "Dette temporelle : metadata45.json"),
    readJson(funscriptUrl, "Dette temporelle : default45.funscript")
  ]);
  if (!metadata || typeof metadata !== "object") throw new Error("Dette temporelle : metadata45.json est invalide.");
  if (!funscript || typeof funscript !== "object" || !Array.isArray(funscript.actions)) throw new Error("Dette temporelle : default45.funscript est invalide.");
  return createLongBossEncounter(baseEncounter, metadata, videoUrl, funscriptUrl, metadataUrl);
}

function initialize() {
  const runtime = getGameRuntime();
  const controller = runtime.encounterController;
  if (!controller || !runtime.gameState || !runtime.mapController || controller.__temporalDebtConnected !== undefined && controller.__temporalDebtConnected !== false) {
    if (!controller || !runtime.gameState || !runtime.mapController) window.setTimeout(initialize, 100);
    return;
  }
  if (!controller.__localLibraryConnected) {
    window.setTimeout(initialize, 100);
    return;
  }
  controller.__temporalDebtConnected = true;
  const originalLoad = controller.load.bind(controller);
  controller.load = async (encounterId) => {
    const currentNode = runtime.mapController.getCurrentNode();
    if (runtime.gameState.activeBlessingId !== "temporal-debt" || currentNode?.type !== "boss") return originalLoad(encounterId);
    const baseEncounter = controller.getEncounterById(encounterId);
    if (!baseEncounter) throw new Error(`Dette temporelle : boss introuvable (${encounterId}).`);
    const longEncounter = await buildLongBossVariant(baseEncounter);
    const originalGetEncounterById = controller.getEncounterById;
    controller.getEncounterById = (requestedId) => requestedId === encounterId ? longEncounter : originalGetEncounterById(requestedId);
    try {
      const loaded = await originalLoad(encounterId);
      const status = document.getElementById("video-status");
      if (status) status.textContent = "Dette temporelle : variante longue du boss chargée (+45 s).";
      return loaded;
    } finally {
      controller.getEncounterById = originalGetEncounterById;
    }
  };
}

window.addEventListener("DOMContentLoaded", initialize);
