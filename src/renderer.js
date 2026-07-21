"use strict";

import {
  formatError
} from "@zendrex/buttplug.js";

import {
  sendPositionCommand as sendDevicePositionCommand,
  stopDevice,
  stopDeviceSilently as stopHandySilently,
  supportsPositionControl
} from "./modules/handy-device.js";

import {
  IntifaceController
} from "./modules/intiface.js";

import {
  VideoFunscriptSynchronizer
} from "./modules/video-sync.js";

import {
  VideoPlayerController
} from "./modules/video-player.js";

import {
  DeviceControlsController
} from "./modules/device-controls.js";

import {
  IntifaceUIController
} from "./modules/intiface-ui.js";

import {
  FunscriptViewController
} from "./modules/funscript-view.js";

import {
  APP_CONFIG,
  DEVICE_CONFIG,
  FUNSCRIPT_TEST_CONFIG,
  VIDEO_CONFIG
} from "./modules/config.js";

const video = document.querySelector("#round-video");

const playButton = document.querySelector("#play-button");
const backwardButton = document.querySelector("#backward-button");
const forwardButton = document.querySelector("#forward-button");
const restartButton = document.querySelector("#restart-button");

const statusText = document.querySelector("#video-status");
const currentTimeText = document.querySelector("#current-time");
const durationText = document.querySelector("#duration");

let funscriptActions = [];
let funscriptView = null;

// --------------------------------------------------
// INTIFACE CENTRAL
// --------------------------------------------------

const deviceControlStatus =
  document.querySelector("#device-control-status");

const lowPositionButton =
  document.querySelector("#low-position-button");

const middlePositionButton =
  document.querySelector("#middle-position-button");

const highPositionButton =
  document.querySelector("#high-position-button");

const emergencyStopButton =
  document.querySelector("#emergency-stop-button");

const testFunscriptButton =
  document.querySelector("#test-funscript-button");

const stopFunscriptButton =
  document.querySelector("#stop-funscript-button");

if (!(deviceControlStatus instanceof HTMLElement)) {
  throw new Error(
    "Le statut de contrôle de l'appareil est introuvable."
  );
}

if (!(lowPositionButton instanceof HTMLButtonElement)) {
  throw new Error("Le bouton Position basse est introuvable.");
}

if (!(middlePositionButton instanceof HTMLButtonElement)) {
  throw new Error("Le bouton Position centrale est introuvable.");
}

if (!(highPositionButton instanceof HTMLButtonElement)) {
  throw new Error("Le bouton Position haute est introuvable.");
}

if (!(emergencyStopButton instanceof HTMLButtonElement)) {
  throw new Error("Le bouton d'arrêt est introuvable.");
}

if (!(testFunscriptButton instanceof HTMLButtonElement)) {
  throw new Error(
    "Le bouton de test du funscript est introuvable."
  );
}

if (!(stopFunscriptButton instanceof HTMLButtonElement)) {
  throw new Error(
    "Le bouton d'arrêt du funscript est introuvable."
  );
}

let selectedDevice = null;
let videoFunscriptSyncRunning = false;
let deviceControls = null;
let intifaceUI = null;

function cancelVideoSyncState() {
  videoSync.cancel();
}

const intiface = new IntifaceController({
  clientName: APP_CONFIG.intifaceClientName,
  verbose: APP_CONFIG.intifaceVerbose,

  onStateChange(state) {
    selectedDevice = state.selectedDevice;

    intifaceUI?.refresh(state);
    updateDeviceControlButtons();
  },

  onDeviceAdded(device) {
    intifaceUI?.handleDeviceAdded(device);
  },

  onDeviceRemoved(device) {
    cancelVideoSyncState();
    intifaceUI?.handleDeviceRemoved(device);
  },

  onScanFinished(deviceCount) {
    intifaceUI?.handleScanFinished(deviceCount);
  },

  onDisconnected() {
    cancelVideoSyncState();
    deviceControls?.handleConnectionLost();
    intifaceUI?.handleDisconnected();
  },

  onConnectionError(error) {
    intifaceUI?.handleConnectionError(error);
  }
});

function updateDeviceControlButtons() {
  deviceControls?.updateButtons();
}

async function stopDeviceSilently() {
  await stopHandySilently(selectedDevice);
}

async function sendPositionCommand(
  normalizedPosition,
  durationMilliseconds
) {
  await sendDevicePositionCommand(
    selectedDevice,
    normalizedPosition,
    durationMilliseconds
  );
}

const videoSync = new VideoFunscriptSynchronizer({
  video,

  getActions() {
    return funscriptActions;
  },

  getDevice() {
    return selectedDevice;
  },

  sendPosition: sendPositionCommand,
  stopDeviceSilently,
  minimumPosition: DEVICE_CONFIG.minimumPosition,
  maximumPosition: DEVICE_CONFIG.maximumPosition,
  syncLookAheadMs: VIDEO_CONFIG.syncLookAheadMs,
  syncTimerPaddingMs: VIDEO_CONFIG.syncTimerPaddingMs,
  freezeMoveDurationMs: VIDEO_CONFIG.freezeMoveDurationMs,
  freezeSettleDelayMs: VIDEO_CONFIG.freezeSettleDelayMs,

  onStateChange(state) {
    videoFunscriptSyncRunning = state.running;
    updateDeviceControlButtons();
  },

  onStatusChange(message) {
    deviceControlStatus.textContent = message;
  },

  onError(message, error) {
    console.error(`${message} :`, error);
    deviceControlStatus.textContent = formatError(error);
  }
});

async function startVideoFunscriptSync() {
  await videoSync.start();
}

async function stopVideoFunscriptSync(options = {}) {
  await videoSync.stop(options);
}

const videoPlayer = new VideoPlayerController({
  video,
  playButton,
  backwardButton,
  forwardButton,
  restartButton,
  statusElement: statusText,
  currentTimeElement: currentTimeText,
  durationElement: durationText,
  seekStepSeconds: VIDEO_CONFIG.seekStepSeconds,

  onFrame() {
    funscriptView?.update();
  },

  async onPlay() {
    await startVideoFunscriptSync();
  },

  async onPause({ freezeAtCurrentPosition }) {
    await stopVideoFunscriptSync({
      freezeAtCurrentPosition
    });
  },

  async onSeeking({ freezeAtCurrentPosition }) {
    await stopVideoFunscriptSync({
      freezeAtCurrentPosition
    });
  },

  async onSeeked() {
    if (!video.paused && !video.ended) {
      await startVideoFunscriptSync();
    }
  },

  async onEnded() {
    await stopVideoFunscriptSync();

    deviceControlStatus.textContent =
      "Vidéo terminée, appareil arrêté.";
  },

  onError(error) {
    if (error !== null) {
      console.error(
        "Erreur signalée par le lecteur vidéo :",
        error
      );
    }
  }
});

funscriptView = new FunscriptViewController({
  video,
  funscriptPath: APP_CONFIG.funscriptPath,

  onActionsChange(actions) {
    funscriptActions = actions;
    updateDeviceControlButtons();
  }
});

intifaceUI = new IntifaceUIController({
  intiface,
  formatError,

  onStateChange() {
    updateDeviceControlButtons();
  },

  onDeviceRemoved() {
    updateDeviceControlButtons();
  },

  onDisconnected() {
    updateDeviceControlButtons();
  },

  async beforeDisconnect() {
    await stopVideoFunscriptSync();

    if (selectedDevice !== null) {
      await deviceControls?.stopSelectedDevice();
    }
  }
});

deviceControls = new DeviceControlsController({
  lowPositionButton,
  middlePositionButton,
  highPositionButton,
  testFunscriptButton,
  stopFunscriptButton,
  emergencyStopButton,
  statusElement: deviceControlStatus,
  minimumPosition: DEVICE_CONFIG.minimumPosition,
  maximumPosition: DEVICE_CONFIG.maximumPosition,
  manualDuration: DEVICE_CONFIG.manualMoveDurationMs,
  minimumManualDuration:
    DEVICE_CONFIG.minimumManualMoveDurationMs,
  testTimeScale: FUNSCRIPT_TEST_CONFIG.timeScale,
  initialTestMoveDuration:
    FUNSCRIPT_TEST_CONFIG.initialMoveDurationMs,

  getConnected() {
    return intiface.connected;
  },

  getDevice() {
    return selectedDevice;
  },

  getClient() {
    return intiface.client;
  },

  getActions() {
    return funscriptActions;
  },

  getVideoSyncRunning() {
    return videoFunscriptSyncRunning;
  },

  pauseVideo() {
    video.pause();
  },

  stopVideoSync: stopVideoFunscriptSync,
  sendPosition: sendPositionCommand,
  stopDevice,
  supportsPositionControl,
  formatError
});

void funscriptView.load().catch(() => {
  updateDeviceControlButtons();
});

updateDeviceControlButtons();