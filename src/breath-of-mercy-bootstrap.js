"use strict";

import { GAME_STATUS } from "./game/game-state.js";
import { getGameRuntime } from "./game/runtime-access.js";

const COMPLETION_EPSILON_SECONDS = 0.12;

function initialize() {
  const runtime = getGameRuntime();
  const video = document.getElementById("round-video");

  if (!runtime.gameState || !runtime.encounterController || !(video instanceof HTMLVideoElement)) {
    window.setTimeout(initialize, 100);
    return;
  }

  if (video.dataset.breathOfMercyReady === "true") return;
  video.dataset.breathOfMercyReady = "true";

  let finishingEncounterKey = null;

  const resetGuard = () => {
    if (video.currentTime < 0.5 || runtime.gameState.status !== GAME_STATUS.ENCOUNTER) {
      finishingEncounterKey = null;
    }
  };

  const applyCutoff = () => {
    if (runtime.gameState.status !== GAME_STATUS.ENCOUNTER) {
      finishingEncounterKey = null;
      return;
    }

    const encounter = runtime.encounterController.getCurrentEncounter?.();
    if (!encounter || encounter.blessingDurationAdjustmentSeconds >= 0) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const reductionSeconds = Math.abs(Number(encounter.blessingDurationAdjustmentSeconds) || 0);
    if (reductionSeconds <= 0) return;

    const cutoffTime = Math.max(0, video.duration - reductionSeconds);
    if (video.currentTime + COMPLETION_EPSILON_SECONDS < cutoffTime) return;

    const encounterKey = `${runtime.gameState.currentEncounter?.nodeId ?? "unknown"}:${encounter.id ?? "encounter"}`;
    if (finishingEncounterKey === encounterKey) return;
    finishingEncounterKey = encounterKey;

    const status = document.getElementById("video-status");
    if (status) status.textContent = `Souffle de clémence : ${reductionSeconds} secondes retirées.`;

    // Aller à la fin réelle laisse le VideoPlayerController déclencher son flux
    // habituel : arrêt du funscript, validation du round et attribution des gains.
    video.currentTime = video.duration;
  };

  video.addEventListener("timeupdate", applyCutoff);
  video.addEventListener("seeking", applyCutoff);
  video.addEventListener("loadedmetadata", resetGuard);
  video.addEventListener("emptied", () => { finishingEncounterKey = null; });
  video.addEventListener("ended", () => { finishingEncounterKey = null; });
}

window.addEventListener("DOMContentLoaded", initialize);
