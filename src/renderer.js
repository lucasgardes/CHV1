"use strict";

import { formatError } from "@zendrex/buttplug.js";
import {
  sendPositionCommand as sendDevicePositionCommand,
  stopDevice,
  stopDeviceSilently as stopHandySilently,
  supportsPositionControl
} from "./modules/handy-device.js";
import { IntifaceController } from "./modules/intiface.js";
import { VideoFunscriptSynchronizer } from "./modules/video-sync.js";
import { VideoPlayerController } from "./modules/video-player.js";
import { DeviceControlsController } from "./modules/device-controls.js";
import { IntifaceUIController } from "./modules/intiface-ui.js";
import { FunscriptViewController } from "./modules/funscript-view.js";
import { getVideoById } from "./data/videos.js";
import { GAME_STATUS, GameState } from "./game/game-state.js";
import { MapController } from "./game/map/map-controller.js";
import { getEventById } from "./data/events.js";
import {
  getItemById,
  getRandomAvailableItem,
  ITEM_TYPES
} from "./data/items.js";
import { ItemController } from "./game/item-controller.js";
import { ActiveItemController } from "./game/active-item-controller.js";
import { EncounterController } from "./game/encounter-controller.js";
import { RoomController } from "./game/room-controller.js";
import {
  APP_CONFIG,
  DEVICE_CONFIG,
  FUNSCRIPT_TEST_CONFIG,
  VIDEO_CONFIG
} from "./modules/config.js";
import { ScreenController } from "./ui/screen-controller.js";
import { MapView } from "./ui/map-view.js";
import { EventView } from "./ui/event-view.js";
import { RewardView } from "./ui/reward-view.js";
import { ActiveItemsView } from "./ui/active-items-view.js";
import { ShopView } from "./ui/shop-view.js";
import { CampfireView } from "./ui/campfire-view.js";

function requireElement(selector, elementType, errorMessage) {
  const element = document.querySelector(selector);
  if (!(element instanceof elementType)) throw new Error(errorMessage);
  return element;
}

const video = requireElement("#round-video", HTMLVideoElement, "Le lecteur vidéo est introuvable.");
const playButton = requireElement("#play-button", HTMLButtonElement, "Le bouton Lecture est introuvable.");
const backwardButton = requireElement("#backward-button", HTMLButtonElement, "Le bouton de retour est introuvable.");
const forwardButton = requireElement("#forward-button", HTMLButtonElement, "Le bouton d’avance est introuvable.");
const restartButton = requireElement("#restart-button", HTMLButtonElement, "Le bouton Recommencer est introuvable.");
const statusText = requireElement("#video-status", HTMLElement, "Le statut vidéo est introuvable.");
const currentTimeText = requireElement("#current-time", HTMLElement, "Le temps courant est introuvable.");
const durationText = requireElement("#duration", HTMLElement, "La durée vidéo est introuvable.");
const deviceControlStatus = requireElement("#device-control-status", HTMLElement, "Le statut de contrôle de l'appareil est introuvable.");
const lowPositionButton = requireElement("#low-position-button", HTMLButtonElement, "Le bouton Position basse est introuvable.");
const middlePositionButton = requireElement("#middle-position-button", HTMLButtonElement, "Le bouton Position centrale est introuvable.");
const highPositionButton = requireElement("#high-position-button", HTMLButtonElement, "Le bouton Position haute est introuvable.");
const emergencyStopButton = requireElement("#emergency-stop-button", HTMLButtonElement, "Le bouton d'arrêt est introuvable.");
const testFunscriptButton = requireElement("#test-funscript-button", HTMLButtonElement, "Le bouton de test du funscript est introuvable.");
const stopFunscriptButton = requireElement("#stop-funscript-button", HTMLButtonElement, "Le bouton d'arrêt du funscript est introuvable.");
const mapNodeList = requireElement("#map-node-list", HTMLDivElement, "La liste des cases de la carte est introuvable.");
const goldValue = requireElement("#gold-value", HTMLElement, "L’affichage de l’or est introuvable.");
const inventoryValue = requireElement("#inventory-value", HTMLElement, "L’affichage de l’inventaire est introuvable.");
const mapScreen = requireElement("#map-screen", HTMLElement, "L’écran de carte est introuvable.");
const eventScreen = requireElement("#event-screen", HTMLElement, "L’écran d’événement est introuvable.");
const eventTitle = requireElement("#event-title", HTMLElement, "Le titre de l’événement est introuvable.");
const eventDescription = requireElement("#event-description", HTMLElement, "La description de l’événement est introuvable.");
const eventChoiceList = requireElement("#event-choice-list", HTMLDivElement, "La liste des choix de l’événement est introuvable.");
const rewardScreen = requireElement("#reward-screen", HTMLElement, "L’écran de récompense est introuvable.");
const rewardChoiceList = requireElement("#reward-choice-list", HTMLDivElement, "La liste des récompenses est introuvable.");
const activeItemStatus = requireElement("#active-item-status", HTMLElement, "Le statut des objets utilisables est introuvable.");
const activeItemList = requireElement("#active-item-list", HTMLDivElement, "La liste des objets utilisables est introuvable.");
const encounterScreen = requireElement("#encounter-screen", HTMLElement, "L’écran de rencontre est introuvable.");
const encounterTitle = requireElement("#encounter-title", HTMLElement, "Le titre de la rencontre est introuvable.");
const shopScreen = requireElement("#shop-screen", HTMLElement, "L’écran de boutique est introuvable.");
const shopGoldValue = requireElement("#shop-gold-value", HTMLElement, "L’or de la boutique est introuvable.");
const shopStockList = requireElement("#shop-stock-list", HTMLDivElement, "Le stock de la boutique est introuvable.");
const shopRerollButton = requireElement("#shop-reroll-button", HTMLButtonElement, "Le bouton de renouvellement est introuvable.");
const shopLeaveButton = requireElement("#shop-leave-button", HTMLButtonElement, "Le bouton de sortie de boutique est introuvable.");
const campfireScreen = requireElement("#campfire-screen", HTMLElement, "L’écran du feu de camp est introuvable.");
const campfireMessage = requireElement("#campfire-message", HTMLElement, "Le message du feu de camp est introuvable.");
const campfireMainChoices = requireElement("#campfire-main-choices", HTMLElement, "Les choix du feu de camp sont introuvables.");
const campfireUpgradeList = requireElement("#campfire-upgrade-list", HTMLElement, "La liste d’amélioration est introuvable.");
const campfireRestButton = requireElement("#campfire-rest-button", HTMLButtonElement, "Le bouton de repos est introuvable.");
const campfireUpgradeButton = requireElement("#campfire-upgrade-button", HTMLButtonElement, "Le bouton d’amélioration est introuvable.");
const settingsPanel = requireElement("#settings-panel", HTMLElement, "Le panneau de connexion est introuvable.");
const openSettingsButton = requireElement("#open-settings-button", HTMLButtonElement, "Le bouton d’ouverture des paramètres est introuvable.");
const closeSettingsButton = requireElement("#close-settings-button", HTMLButtonElement, "Le bouton de fermeture des paramètres est introuvable.");

const gameState = new GameState();
const mapController = new MapController({ gameState });
const itemController = new ItemController({ gameState });
const screenController = new ScreenController({
  mapScreen,
  encounterScreen,
  eventScreen,
  rewardScreen,
  shopScreen,
  campfireScreen,
  settingsPanel
});

let funscriptActions = [];
let funscriptView = null;
let encounterController = null;
let activeItemController = null;
let roomController = null;
let selectedDevice = null;
let videoFunscriptSyncRunning = false;
let deviceControls = null;
let intifaceUI = null;

function updateResourceDisplay() {
  goldValue.textContent = String(gameState.gold);
  inventoryValue.textContent = gameState.inventory.length === 0
    ? "Aucun"
    : gameState.inventory.map((itemId) => {
      const item = getItemById(itemId);
      return `${item?.name ?? itemId}${gameState.isItemUpgraded(itemId) ? " +" : ""}`;
    }).join(", ");
}

function renderMap() {
  activeItemController?.cancelActiveEffect();
  screenController.showMap();
  mapView.render({
    gameState,
    currentNode: mapController.getCurrentNode(),
    accessibleNodes: mapController.getAccessibleNodes()
  });
  updateResourceDisplay();
}

function renderActiveItems() {
  if (gameState.status !== GAME_STATUS.ENCOUNTER) {
    activeItemsView.render({
      status: "Les objets sont utilisables pendant une rencontre.",
      items: []
    });
    return;
  }

  const items = gameState.inventory
    .map((itemId) => getItemById(itemId))
    .filter((item) => item !== null && (
      item.type === ITEM_TYPES.RECHARGEABLE ||
      item.type === ITEM_TYPES.CONSUMABLE
    ))
    .map((item) => activeItemController.getItemModel(item.id));

  activeItemsView.render({
    status: items.length === 0 ? "Aucun objet utilisable." : "Choisis un objet à utiliser.",
    items
  });
}

async function useActiveItem(itemId) {
  try {
    await activeItemController.use(itemId);
    const model = activeItemController.getItemModel(itemId);
    activeItemsView.setStatus(`${model.name} utilisé — ${model.statusLabel}.`);
  } catch (error) {
    console.error("Impossible d’utiliser l’objet :", error);
    activeItemsView.setStatus("Impossible d’utiliser cet objet.");
  } finally {
    renderActiveItems();
  }
}

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
    void resolveEventChoice(event, choice);
  }
});

const rewardView = new RewardView({
  rewardChoiceList,
  onRewardSelected(reward) {
    try {
      resolveEliteReward(reward);
    } catch (error) {
      console.error("Impossible de choisir la récompense :", error);
      rewardView.enableChoices();
    }
  }
});

const activeItemsView = new ActiveItemsView({
  activeItemStatus,
  activeItemList,
  onItemSelected(itemId) {
    void useActiveItem(itemId);
  }
});

const shopView = new ShopView({
  screen: shopScreen,
  goldValue: shopGoldValue,
  stockList: shopStockList,
  rerollButton: shopRerollButton,
  leaveButton: shopLeaveButton,
  onBuy(itemId) {
    roomController.buyItem(itemId);
    updateResourceDisplay();
  },
  onReroll() {
    roomController.rerollShop();
    updateResourceDisplay();
  },
  onLeave() {
    roomController.completeRoom();
  }
});

const campfireView = new CampfireView({
  screen: campfireScreen,
  message: campfireMessage,
  mainChoices: campfireMainChoices,
  upgradeList: campfireUpgradeList,
  restButton: campfireRestButton,
  upgradeButton: campfireUpgradeButton,
  onRest() {
    roomController.rest();
  },
  onUpgradeSelected(itemId) {
    roomController.upgradeItem(itemId);
    updateResourceDisplay();
  }
});

roomController = new RoomController({
  gameState,
  itemController,
  shopView,
  campfireView,
  onRoomCompleted: renderMap
});

activeItemController = new ActiveItemController({
  gameState,
  itemController,
  video,
  onStateChange: renderActiveItems,
  onStatusChange(message) {
    activeItemsView.setStatus(message);
  }
});

function updateDeviceControlButtons() {
  deviceControls?.updateButtons();
}

function cancelVideoSyncState() {
  videoSync.cancel();
}

async function stopDeviceSilently() {
  await stopHandySilently(selectedDevice);
}

async function sendPositionCommand(normalizedPosition, durationMilliseconds) {
  await sendDevicePositionCommand(
    selectedDevice,
    normalizedPosition,
    durationMilliseconds
  );
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
    await stopVideoFunscriptSync({ freezeAtCurrentPosition });
    renderActiveItems();
  },
  async onSeeking({ freezeAtCurrentPosition }) {
    await stopVideoFunscriptSync({ freezeAtCurrentPosition });
  },
  async onSeeked() {
    if (!video.paused && !video.ended) await startVideoFunscriptSync();
  },
  async onEnded() {
    activeItemController.cancelActiveEffect();
    await stopVideoFunscriptSync();
    deviceControlStatus.textContent = "Vidéo terminée, appareil arrêté.";

    try {
      await encounterController?.complete();
    } catch (error) {
      console.error("Impossible de terminer la rencontre :", error);
      statusText.textContent = "Erreur lors de la fin de la rencontre.";
    }

    renderActiveItems();
  },
  onError(error) {
    if (error !== null) console.error("Erreur signalée par le lecteur vidéo :", error);
  }
});

function renderEvent(eventId) {
  const event = getEventById(eventId);
  if (event === null) throw new Error(`Événement introuvable : ${eventId}`);
  screenController.showEvent();
  eventView.render(event);
}

function renderEliteReward(encounter) {
  screenController.showReward();
  rewardView.render({
    goldAmount: encounter.rewardGold,
    item: getRandomAvailableItem(gameState.inventory)
  });
}

function resolveEliteReward(reward) {
  if (reward.type === "gold") {
    gameState.addGold(reward.amount);
    statusText.textContent = `Récompense d’élite : +${reward.amount} or`;
  } else if (reward.type === "item") {
    const item = getItemById(reward.itemId);
    if (item === null) throw new Error(`Objet introuvable : ${reward.itemId}`);
    if (!gameState.addItem(item.id)) throw new Error(`L’objet ${item.name} est déjà possédé.`);
    itemController.ensureRuntimeState(item.id);
    statusText.textContent = `${item.name} ajouté à l’inventaire.`;
  } else {
    throw new Error(`Type de récompense inconnu : ${reward.type}`);
  }

  gameState.setCurrentEncounter(null);
  gameState.setStatus(GAME_STATUS.MAP);
  renderMap();
}

async function resolveEventChoice(event, choice) {
  try {
    switch (choice.effect.type) {
      case "gain-gold":
        gameState.addGold(choice.effect.amount);
        statusText.textContent = `Événement terminé : +${choice.effect.amount} or`;
        break;
      case "none":
        statusText.textContent = "Événement terminé sans conséquence.";
        break;
      default:
        throw new Error(`Effet inconnu : ${choice.effect.type}`);
    }

    gameState.completeCurrentNode();
    gameState.setStatus(GAME_STATUS.MAP);
    renderMap();
  } catch (error) {
    console.error("Impossible de résoudre l’événement :", error);
    statusText.textContent = "Erreur pendant l’événement.";
    eventView.enableChoices();
  }
}

async function openEncounter(selectedNode) {
  if (!selectedNode.encounterId) {
    throw new Error(`Aucune rencontre associée à la case ${selectedNode.id}.`);
  }

  activeItemController.cancelActiveEffect();
  gameState.setCurrentEncounter({
    nodeId: selectedNode.id,
    encounterId: selectedNode.encounterId,
    type: selectedNode.type
  });
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  encounterTitle.textContent = selectedNode.title;
  screenController.showEncounter();
  await encounterController.load(selectedNode.encounterId);
  statusText.textContent = `Rencontre : ${selectedNode.title}`;
}

async function handleNodeSelection(nodeId) {
  if (gameState.status !== GAME_STATUS.MAP) return;

  try {
    const selectedNode = mapController.moveToNode(nodeId);

    switch (selectedNode.type) {
      case "normal":
      case "elite":
      case "boss":
        await openEncounter(selectedNode);
        return;
      case "event":
        if (!selectedNode.eventId) {
          throw new Error(`Aucun événement associé à la case ${selectedNode.id}.`);
        }
        gameState.setStatus(GAME_STATUS.EVENT);
        renderEvent(selectedNode.eventId);
        return;
      case "shop":
        gameState.setStatus(GAME_STATUS.SHOP);
        roomController.open(selectedNode);
        return;
      case "campfire":
        gameState.setStatus(GAME_STATUS.CAMPFIRE);
        roomController.open(selectedNode);
        return;
      default:
        gameState.setStatus(GAME_STATUS.MAP);
        renderMap();
    }
  } catch (error) {
    console.error("Impossible de sélectionner la case :", error);
    statusText.textContent = "Impossible d’ouvrir cette case.";
  }
}

openSettingsButton.addEventListener("click", () => screenController.openSettings());
closeSettingsButton.addEventListener("click", () => screenController.closeSettings());
settingsPanel.addEventListener("click", (event) => {
  if (event.target === settingsPanel) screenController.closeSettings();
});

funscriptView = new FunscriptViewController({
  video,
  funscriptPath: "../assets/funscripts/test-video.funscript",
  onActionsChange(actions) {
    funscriptActions = actions;
    updateDeviceControlButtons();
  }
});

encounterController = new EncounterController({
  gameState,
  itemController,
  video,
  getEncounterById: getVideoById,
  stopVideoSync: stopVideoFunscriptSync,
  setFunscriptPath(funscriptPath) {
    funscriptView.setFunscriptPath(funscriptPath);
  },
  async loadFunscript() {
    await funscriptView.load();
  },
  resetActions() {
    funscriptActions = [];
  },
  onEncounterLoaded(encounter) {
    statusText.textContent = encounter.title;
    renderActiveItems();
    updateDeviceControlButtons();
  },
  onPlaybackFallback(encounter, error) {
    console.error("Impossible de lancer automatiquement la vidéo :", error);
    statusText.textContent = "Vidéo chargée. Appuie sur Lecture pour commencer.";
  },
  onNormalCompleted({ rewardGold }) {
    statusText.textContent = `Rencontre terminée : +${rewardGold} or`;
    renderMap();
  },
  onEliteCompleted({ encounter }) {
    renderEliteReward(encounter);
  },
  onBossCompleted({ rewardGold, gameState: completedState }) {
    statusText.textContent = `Boss vaincu ! Récompense : ${rewardGold} or.`;
    goldValue.textContent = String(completedState.gold);
  }
});

intifaceUI = new IntifaceUIController({
  intiface,
  formatError,
  onStateChange: updateDeviceControlButtons,
  onDeviceRemoved: updateDeviceControlButtons,
  onDisconnected: updateDeviceControlButtons,
  async beforeDisconnect() {
    await stopVideoFunscriptSync();
    if (selectedDevice !== null) await deviceControls?.stopSelectedDevice();
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
  minimumManualDuration: DEVICE_CONFIG.minimumManualMoveDurationMs,
  testTimeScale: FUNSCRIPT_TEST_CONFIG.timeScale,
  initialTestMoveDuration: FUNSCRIPT_TEST_CONFIG.initialMoveDurationMs,
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
itemController.resetForRun();
renderMap();
renderActiveItems();
updateDeviceControlButtons();
