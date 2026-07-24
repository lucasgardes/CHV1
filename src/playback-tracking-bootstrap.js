"use strict";

import { getGameRuntime } from "./game/runtime-access.js";

const state = { active:null, itemEvents:[] };
function videoElement() { return document.getElementById("round-video"); }
function contextFor(encounter) { return encounter?.playbackContext === "event" ? "event" : "run"; }
function progressPercent(video) { return video && Number.isFinite(video.duration) && video.duration > 0 ? Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100)) : 0; }
function watchSeconds(video) { return video ? Math.max(0, Number(video.currentTime) || 0) : 0; }
function snapshotFor(encounter) { return { title:encounter?.title || encounter?.mediaId || encounter?.id || "Vidéo", type:encounter?.type || "normal", durationSeconds:Number(encounter?.durationSeconds) || 0, difficulties:Object.keys(encounter?.funscripts || {}), themes:[...(encounter?.themes || [])], performers:[...(encounter?.performers || [])], thumbnailPath:encounter?.thumbnailPath || null }; }
async function record(type, extra = {}) {
  if (!state.active || !globalThis.chv1Playback?.record) return;
  const video = videoElement();
  await globalThis.chv1Playback.record({ type, videoId:state.active.videoId, difficulty:state.active.difficulty, playbackContext:state.active.playbackContext, watchSeconds:watchSeconds(video), progressPercent:progressPercent(video), snapshot:state.active.snapshot, itemEvents:[...state.itemEvents], ...extra });
  window.dispatchEvent(new CustomEvent("chv1:stats-updated")); window.dispatchEvent(new CustomEvent("chv1:collection-updated"));
}

function initialize() {
  const runtime = getGameRuntime(); const controller = runtime.encounterController; const activeItems = runtime.activeItemController;
  if (!controller || !activeItems) { window.setTimeout(initialize, 100); return; }
  if (controller.__playbackTrackingConnected) return; controller.__playbackTrackingConnected = true;
  const originalLoad = controller.load.bind(controller);
  controller.load = async (...args) => {
    const encounter = await originalLoad(...args); const videoId = encounter?.mediaId || String(encounter?.id || "").replace(/^local:/, ""); state.itemEvents = [];
    if (videoId) { state.active = { videoId, difficulty:encounter.selectedFunscriptDifficulty || encounter.selectedDifficulty || encounter.defaultFunscriptDifficulty || "default", playbackContext:contextFor(encounter), snapshot:snapshotFor(encounter) }; await record("start"); } else state.active = null;
    return encounter;
  };
  const originalComplete = controller.complete.bind(controller);
  controller.complete = async (...args) => { if (state.active) await record("win", { progressPercent:100 }); const result = await originalComplete(...args); state.active = null; state.itemEvents = []; return result; };
  const originalUse = activeItems.use.bind(activeItems);
  activeItems.use = async (itemId, ...args) => { const result = await originalUse(itemId, ...args); const usedAtSeconds = watchSeconds(videoElement()); state.itemEvents.push({ itemId, usedAtSeconds, difficulty:state.active?.difficulty }); await record("item-used", { itemId, usedAtSeconds }); return result; };
  const defeatButton = document.getElementById("declare-defeat-button");
  defeatButton?.addEventListener("click", () => { if (state.active) void record("loss").finally(() => { state.active = null; state.itemEvents = []; }); }, { capture:true });
}

window.addEventListener("DOMContentLoaded", initialize);
