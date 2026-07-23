"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";
import { LocalSaveService } from "./game/local-save.js";
import { PhaseOneController } from "./game/phase-one-controller.js";
import { PhaseOneView } from "./ui/phase-one-view.js";

let phaseOneController = null;
let phaseOneView = null;
let bossEndingHandled = false;

function stopEncounter() {
  const emergencyStop = document.getElementById("emergency-stop-button");
  if (emergencyStop instanceof HTMLButtonElement && !emergencyStop.disabled) emergencyStop.click();
  const video = document.getElementById("round-video");
  if (video instanceof HTMLVideoElement) video.pause();
  return new Promise((resolve) => window.setTimeout(resolve, 150));
}

function showMap(runtime) {
  runtime.screenController?.showMap();
  runtime.mapView?.render({
    gameState: runtime.gameState,
    currentNode: runtime.mapController?.getCurrentNode(),
    accessibleNodes: runtime.mapController?.getAccessibleNodes() ?? []
  });
}

function syncHiddenEncounter(runtime) {
  if (!runtime.gameState || !runtime.mapController) return null;
  const canReveal = runtime.gameState.hasItem("last-act-key") || runtime.gameState.hasItem("scout");
  if (!canReveal) return null;
  const hiddenNode = runtime.mapController.revealHiddenEncounter();
  if (hiddenNode) {
    hiddenNode.hiddenEncounter = true;
    hiddenNode.hidden = false;
    hiddenNode.type = "normal";
    hiddenNode.title = "Rencontre cachée";
    hiddenNode.rewardGold = 0;
  }
  return hiddenNode;
}

function handleTransition(runtime, transition) {
  if (transition.type === "white-space") {
    phaseOneView.showWhiteSpace({
      loopCount: transition.loopCount,
      message: transition.message,
      onContinue() {
        phaseOneController.restartAfterLoop();
        bossEndingHandled = false;
        showMap(runtime);
      }
    });
  }

  if (transition.type === "ending") {
    phaseOneView.showEnding({
      ending: transition.ending,
      onRestart() {
        phaseOneController.startRun();
        bossEndingHandled = false;
        showMap(runtime);
      }
    });
  }
}

function initialize() {
  const runtime = getGameRuntime();
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController || !runtime.screenController) {
    window.setTimeout(initialize, 100);
    return;
  }

  phaseOneView = new PhaseOneView({
    screen: document.getElementById("phase-one-screen"),
    kicker: document.getElementById("phase-one-kicker"),
    title: document.getElementById("phase-one-title"),
    message: document.getElementById("phase-one-message"),
    primaryButton: document.getElementById("phase-one-primary-button"),
    secondaryButton: document.getElementById("phase-one-secondary-button")
  });

  phaseOneController = new PhaseOneController({
    ...runtime,
    defeatController: new DefeatController({ gameState: runtime.gameState, mapController: runtime.mapController }),
    saveService: new LocalSaveService(),
    stopEncounter,
    onTransition: (transition) => handleTransition(runtime, transition)
  });

  globalThis.__CHV1_PHASE_ONE__ = {
    controller: phaseOneController,
    view: phaseOneView,
    processDefeat: () => phaseOneController.processDefeat(),
    syncHiddenEncounter: () => syncHiddenEncounter(runtime)
  };

  syncHiddenEncounter(runtime);

  const mapScreen = document.getElementById("map-screen");
  if (mapScreen) {
    new MutationObserver(() => {
      if (!mapScreen.hidden && syncHiddenEncounter(runtime)) showMap(runtime);
    }).observe(mapScreen, { attributes: true, attributeFilter: ["hidden"] });
  }

  const video = document.getElementById("round-video");
  if (video instanceof HTMLVideoElement) {
    video.addEventListener("ended", () => {
      window.setTimeout(() => {
        if (runtime.gameState.status !== "victory" || bossEndingHandled) return;
        bossEndingHandled = true;
        phaseOneController.completeBoss();
      }, 0);
    });
  }
}

window.addEventListener("DOMContentLoaded", initialize);
