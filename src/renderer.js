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
  getVideoById
} from "./data/videos.js";

import {
  GAME_STATUS,
  GameState
} from "./game/game-state.js";

import {
  MapController
} from "./game/map/map-controller.js";

import {
  getEventById
} from "./data/events.js";

import {
  getItemById,
  getRandomAvailableItem
} from "./data/items.js";

import {
  ItemController
} from "./game/item-controller.js";

import {
  APP_CONFIG,
  DEVICE_CONFIG,
  FUNSCRIPT_TEST_CONFIG,
  VIDEO_CONFIG
} from "./modules/config.js";

import {
  ScreenController
} from "./ui/screen-controller.js";

import {
  MapView
} from "./ui/map-view.js";

import {
  EventView
} from "./ui/event-view.js";

import {
  RewardView
} from "./ui/reward-view.js";

import {
  ActiveItemsView
} from "./ui/active-items-view.js";

const video = document.querySelector("#round-video");

const playButton = document.querySelector("#play-button");
const backwardButton = document.querySelector("#backward-button");
const forwardButton = document.querySelector("#forward-button");
const restartButton = document.querySelector("#restart-button");

const statusText = document.querySelector("#video-status");
const currentTimeText = document.querySelector("#current-time");
const durationText = document.querySelector("#duration");

const gameState = new GameState();

const mapController = new MapController({
  gameState
});

const itemController = new ItemController({
  gameState
});


let funscriptActions = [];
let funscriptView = null;
let currentEncounter = null;

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

const mapNodeList =
  document.querySelector("#map-node-list");

const goldValue =
  document.querySelector("#gold-value");

  const mapScreen =
  document.querySelector("#map-screen");

const eventScreen =
  document.querySelector("#event-screen");

const eventTitle =
  document.querySelector("#event-title");

const eventDescription =
  document.querySelector("#event-description");

const eventChoiceList =
  document.querySelector("#event-choice-list");

const rewardScreen =
  document.querySelector("#reward-screen");

const rewardChoiceList =
  document.querySelector("#reward-choice-list");

const inventoryValue =
  document.querySelector("#inventory-value");

const activeItemStatus =
  document.querySelector("#active-item-status");

const activeItemList =
  document.querySelector("#active-item-list");

const encounterScreen =
  document.querySelector("#encounter-screen");

const encounterTitle =
  document.querySelector("#encounter-title");

const settingsPanel =
  document.querySelector("#settings-panel");

const openSettingsButton =
  document.querySelector("#open-settings-button");

const closeSettingsButton =
  document.querySelector("#close-settings-button");

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

if (!(mapNodeList instanceof HTMLDivElement)) {
  throw new Error(
    "La liste des cases de la carte est introuvable."
  );
}

if (!(goldValue instanceof HTMLElement)) {
  throw new Error(
    "L’affichage de l’or est introuvable."
  );
}

if (!(mapScreen instanceof HTMLElement)) {
  throw new Error(
    "L’écran de carte est introuvable."
  );
}

if (!(eventScreen instanceof HTMLElement)) {
  throw new Error(
    "L’écran d’événement est introuvable."
  );
}

if (!(eventTitle instanceof HTMLElement)) {
  throw new Error(
    "Le titre de l’événement est introuvable."
  );
}

if (!(eventDescription instanceof HTMLElement)) {
  throw new Error(
    "La description de l’événement est introuvable."
  );
}

if (!(eventChoiceList instanceof HTMLDivElement)) {
  throw new Error(
    "La liste des choix de l’événement est introuvable."
  );
}

if (!(rewardScreen instanceof HTMLElement)) {
  throw new Error(
    "L’écran de récompense est introuvable."
  );
}

if (!(rewardChoiceList instanceof HTMLDivElement)) {
  throw new Error(
    "La liste des récompenses est introuvable."
  );
}

if (!(inventoryValue instanceof HTMLElement)) {
  throw new Error(
    "L’affichage de l’inventaire est introuvable."
  );
}

if (!(activeItemStatus instanceof HTMLElement)) {
  throw new Error(
    "Le statut des objets utilisables est introuvable."
  );
}

if (!(activeItemList instanceof HTMLDivElement)) {
  throw new Error(
    "La liste des objets utilisables est introuvable."
  );
}

if (!(encounterScreen instanceof HTMLElement)) {
  throw new Error(
    "L’écran de rencontre est introuvable."
  );
}

if (!(encounterTitle instanceof HTMLElement)) {
  throw new Error(
    "Le titre de la rencontre est introuvable."
  );
}

if (!(settingsPanel instanceof HTMLElement)) {
  throw new Error(
    "Le panneau de connexion est introuvable."
  );
}

if (
  !(openSettingsButton instanceof HTMLButtonElement)
) {
  throw new Error(
    "Le bouton d’ouverture des paramètres est introuvable."
  );
}

if (
  !(closeSettingsButton instanceof HTMLButtonElement)
) {
  throw new Error(
    "Le bouton de fermeture des paramètres est introuvable."
  );
}

const screenController =
  new ScreenController({
    mapScreen,
    encounterScreen,
    eventScreen,
    rewardScreen,
    settingsPanel
  });

const mapView = new MapView({
  mapNodeList,
  goldValue,
  inventoryValue,
  getItemById,

  onNodeSelected(nodeId) {
    void handleNodeSelection(nodeId);
  }
});

const eventView = new EventView({
  eventTitle,
  eventDescription,
  eventChoiceList,

  onChoiceSelected(event, choice) {
    void resolveEventChoice(
      event,
      choice
    );
  }
});

const rewardView = new RewardView({
  rewardChoiceList,

  onRewardSelected(reward) {
    try {
      resolveEliteReward(reward);
    } catch (error) {
      console.error(
        "Impossible de choisir la récompense :",
        error
      );

      rewardView.enableChoices();
    }
  }
});

const activeItemsView =
  new ActiveItemsView({
    activeItemStatus,
    activeItemList,

    onItemSelected(itemId) {
      void useActiveItem(itemId);
    }
  });

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
    renderActiveItems();
  },

  async onPause({ freezeAtCurrentPosition }) {
    await stopVideoFunscriptSync({
      freezeAtCurrentPosition
    });

    renderActiveItems();
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

    try {
      await completeCurrentEncounter();
    } catch (error) {
      console.error(
        "Impossible de terminer la rencontre :",
        error
      );

      statusText.textContent =
        "Erreur lors de la fin de la rencontre.";
    }
    renderActiveItems();
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

async function loadEncounter(videoId) {
  const encounter = getVideoById(videoId);

  if (encounter === null) {
    throw new Error(`Vidéo introuvable : ${videoId}`);
  }

  await stopVideoFunscriptSync();

  currentEncounter = encounter;
  funscriptActions = [];

  video.pause();
  video.src = encounter.videoPath;
  video.load();

  funscriptView.setFunscriptPath(encounter.funscriptPath);
  await funscriptView.load();

  statusText.textContent = encounter.title;

  itemController.resetForEncounter();

  try {
    await video.play();
  } catch (error) {
    console.error(
      "Impossible de lancer automatiquement la vidéo :",
      error
    );

    statusText.textContent =
      "Vidéo chargée. Appuie sur Lecture pour commencer.";
  }
  
  renderActiveItems();
  updateDeviceControlButtons();
}

async function completeCurrentEncounter() {
  const encounterState =
    gameState.currentEncounter;

  if (encounterState === null) {
    console.warn(
      "Aucune rencontre active à terminer."
    );

    return;
  }

  const encounter =
    getVideoById(encounterState.encounterId);

  if (encounter === null) {
    throw new Error(
      `Rencontre introuvable : ${encounterState.encounterId}`
    );
  }

  const rewardGold =
    Number.isFinite(encounter.rewardGold)
      ? encounter.rewardGold
      : 0;

  gameState.completeCurrentNode();

  if (encounter.type === "boss") {
    gameState.setStatus(
      GAME_STATUS.VICTORY
    );

    statusText.textContent =
      `Boss vaincu ! Récompense : ${rewardGold} or.`;

    goldValue.textContent =
      String(gameState.gold);

    console.log(
      "Partie gagnée :",
      gameState
    );

    return;
  }

  if (encounter.type === "elite") {
    gameState.setStatus(
      GAME_STATUS.REWARD
    );

    renderEliteReward(encounter);

    console.log(
      "Récompense d’élite affichée :",
      encounter
    );

    return;
  }

  gameState.addGold(rewardGold);
  gameState.setCurrentEncounter(null);

  gameState.setStatus(
    GAME_STATUS.MAP
  );

  statusText.textContent =
    `Rencontre terminée : +${rewardGold} or`;

  renderMap();

  console.log(
    "Rencontre terminée :",
    gameState
  );
}

function renderActiveItems() {
  if (gameState.status !== GAME_STATUS.ENCOUNTER) {
    activeItemsView.render({
      status:
        "Les objets sont utilisables pendant une rencontre.",
      items: []
    });

    return;
  }

  const usableItems =
    gameState.inventory
      .map((itemId) => getItemById(itemId))
      .filter((item) => {
        return (
          item !== null &&
          (
            item.type === "rechargeable" ||
            item.type === "consumable"
          )
        );
      });

  if (usableItems.length === 0) {
    activeItemsView.render({
      status:
        "Aucun objet utilisable.",
      items: []
    });

    return;
  }

  const renderedItems =
    usableItems.map((item) => {
      if (item.id === "time-out") {
        return {
          id: item.id,
          name: item.name,
          disabled:
            !itemController.isAvailable(
              item.id
            ) ||
            video.paused ||
            video.ended
        };
      }

      return {
        id: item.id,
        name: item.name,
        disabled: true,
        title:
          "Cet objet n’est pas encore implémenté."
      };
    });

  activeItemsView.render({
    status:
      "Choisis un objet à utiliser.",
    items:
      renderedItems
  });
}

async function useActiveItem(itemId) {
  try {
    if (gameState.status !== GAME_STATUS.ENCOUNTER) {
      throw new Error(
        "Aucune rencontre n’est actuellement en cours."
      );
    }

    if (!itemController.hasItem(itemId)) {
      throw new Error(
        `L’objet ${itemId} n’est pas possédé.`
      );
    }

    switch (itemId) {
      case "time-out":
        await useTimeOut();
        break;

      default:
        throw new Error(
          `L’objet ${itemId} n’est pas encore utilisable.`
        );
    }
  } catch (error) {
    console.error(
      "Impossible d’utiliser l’objet :",
      error
    );

    activeItemsView.setStatus(
      "Impossible d’utiliser cet objet."
    );
  }
}

function wait(durationMilliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      durationMilliseconds
    );
  });
}

async function runCountdown(
  durationSeconds,
  onTick
) {
  for (
    let remainingSeconds = durationSeconds;
    remainingSeconds > 0;
    remainingSeconds -= 1
  ) {
    onTick(remainingSeconds);

    await wait(1000);
  }

  onTick(0);
}

async function useTimeOut() {
  if (!itemController.isAvailable("time-out")) {
    throw new Error(
      "Temps mort n’est pas disponible."
    );
  }

  if (video.paused || video.ended) {
    throw new Error(
      "La vidéo doit être en cours de lecture."
    );
  }

  itemController.activate("time-out");
  itemController.consumeCharge("time-out");

  renderActiveItems();

  video.pause();

  await runCountdown(
    30,
    (remainingSeconds) => {
      activeItemsView.setStatus(
        remainingSeconds > 0
          ? `Temps mort actif : reprise dans ${remainingSeconds} seconde${remainingSeconds > 1 ? "s" : ""}.`
          : "Reprise de la vidéo..."
      );
    }
  );

  itemController.finishActivation("time-out");

  if (
    gameState.status === GAME_STATUS.ENCOUNTER &&
    !video.ended
  ) {
    await video.play();

    activeItemsView.setStatus(
      "Temps mort utilisé. Recharge au prochain round."
    );
  }

  renderActiveItems();
}

function renderMap() {
  screenController.showMap();

  mapView.render({
    gameState,
    currentNode:
      mapController.getCurrentNode(),
    accessibleNodes:
      mapController.getAccessibleNodes()
  });
}

async function handleNodeSelection(nodeId) {
  if (gameState.status !== GAME_STATUS.MAP) {
    console.warn(
      "Une case ne peut être sélectionnée que depuis la carte."
    );

    return;
  }
  try {
    const selectedNode =
      mapController.moveToNode(nodeId);

    console.log(
      "Case sélectionnée :",
      selectedNode
    );

    if (
      selectedNode.type === "normal" ||
      selectedNode.type === "elite" ||
      selectedNode.type === "boss"
    ) {
      if (!selectedNode.encounterId) {
        throw new Error(
          `Aucune rencontre associée à la case ${selectedNode.id}.`
        );
      }

      gameState.setCurrentEncounter({
        nodeId: selectedNode.id,
        encounterId: selectedNode.encounterId,
        type: selectedNode.type
      });

      gameState.setStatus(
        GAME_STATUS.ENCOUNTER
      );

      console.log(
        "Chargement de la rencontre :",
        selectedNode.encounterId
      );

      encounterTitle.textContent =
        selectedNode.title;

      screenController.showEncounter();

      await loadEncounter(
        selectedNode.encounterId
      );

      console.log("Rencontre chargée avec succès.");

      statusText.textContent =
        `Rencontre : ${selectedNode.title}`;

      console.log(
        "État après sélection :",
        gameState
      );

      console.log(
        "Vidéo chargée :",
        video.src
      );

      console.log(
        "Funscript courant :",
        funscriptView.funscriptPath
      );

      return;
    }

    if (selectedNode.type === "event") {
      if (!selectedNode.eventId) {
        throw new Error(
          `Aucun événement associé à la case ${selectedNode.id}.`
        );
      }

      gameState.setStatus(
        GAME_STATUS.EVENT
      );

      renderEvent(
        selectedNode.eventId
      );

      return;
    }

    gameState.setStatus(
      GAME_STATUS.MAP
    );

    renderMap();
    console.log(
      "État après sélection :",
      gameState
    );
  } catch (error) {
    console.error(
      "Impossible de sélectionner la case :",
      error
    );

    statusText.textContent =
      "Impossible d’ouvrir cette case.";
  }
}

function renderEvent(eventId) {
  const event = getEventById(eventId);

  if (event === null) {
    throw new Error(
      `Événement introuvable : ${eventId}`
    );
  }

  screenController.showEvent();
  eventView.render(event);
}

function renderEliteReward(encounter) {
  screenController.showReward();

  const randomItem =
    getRandomAvailableItem(
      gameState.inventory
    );

  rewardView.render({
    goldAmount:
      encounter.rewardGold,
    item:
      randomItem
  });
}

function resolveEliteReward(reward) {
  if (reward.type === "gold") {
    gameState.addGold(reward.amount);

    statusText.textContent =
      `Récompense d’élite : +${reward.amount} or`;
  } else if (reward.type === "item") {
    const item =
      getItemById(reward.itemId);

    if (item === null) {
      throw new Error(
        `Objet introuvable : ${reward.itemId}`
      );
    }

    const itemAdded =
      gameState.addItem(item.id);

    if (!itemAdded) {
      throw new Error(
        `L’objet ${item.name} est déjà possédé.`
      );
    }

    statusText.textContent =
      `${item.name} ajouté à l’inventaire.`;
  } else {
    throw new Error(
      `Type de récompense inconnu : ${reward.type}`
    );
  }

  gameState.setCurrentEncounter(null);
  gameState.setStatus(
    GAME_STATUS.MAP
  );

  renderMap();

  console.log(
    "Récompense d’élite choisie :",
    {
      reward,
      gameState
    }
  );
}

async function resolveEventChoice(
  event,
  choice
) {
  try {
    switch (choice.effect.type) {
      case "gain-gold":
        gameState.addGold(
          choice.effect.amount
        );

        statusText.textContent =
          `Événement terminé : +${choice.effect.amount} or`;
        break;

      case "none":
        statusText.textContent =
          "Événement terminé sans conséquence.";
        break;

      default:
        throw new Error(
          `Effet inconnu : ${choice.effect.type}`
        );
    }

    gameState.completeCurrentNode();
    gameState.setStatus(
      GAME_STATUS.MAP
    );

    renderMap();

    console.log(
      "Événement résolu :",
      {
        eventId: event.id,
        choiceId: choice.id,
        gameState
      }
    );
  } catch (error) {
    console.error(
      "Impossible de résoudre l’événement :",
      error
    );

    statusText.textContent =
      "Erreur pendant l’événement.";

    eventView.enableChoices();
  }
}

openSettingsButton.addEventListener(
  "click",
  () => {
    screenController.openSettings();
  }
);

closeSettingsButton.addEventListener(
  "click",
  () => {
    screenController.closeSettings();
  }
);

settingsPanel.addEventListener(
  "click",
  (event) => {
    if (event.target === settingsPanel) {
      screenController.closeSettings();
    }
  }
);

funscriptView = new FunscriptViewController({
  video,
  funscriptPath: "../assets/funscripts/test-video.funscript",

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

gameState.startRun();
gameState.addItem("time-out");
renderMap();
renderActiveItems();
updateDeviceControlButtons();