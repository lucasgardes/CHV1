"use strict";

import {
  clamp
} from "./funscript.js";

import {
  DEVICE_CONFIG,
  FUNSCRIPT_TEST_CONFIG
} from "./config.js";

export class DeviceControlsController {
  constructor({
    lowPositionButton,
    middlePositionButton,
    highPositionButton,
    testFunscriptButton,
    stopFunscriptButton,
    emergencyStopButton,
    statusElement,
    getConnected,
    getDevice,
    getClient,
    getActions,
    getVideoSyncRunning,
    pauseVideo,
    stopVideoSync,
    sendPosition,
    stopDevice,
    supportsPositionControl,
    formatError,
    minimumPosition = DEVICE_CONFIG.minimumPosition,
    maximumPosition = DEVICE_CONFIG.maximumPosition,
    manualDuration = DEVICE_CONFIG.manualMoveDurationMs,
    minimumManualDuration =
      DEVICE_CONFIG.minimumManualMoveDurationMs,
    testTimeScale = FUNSCRIPT_TEST_CONFIG.timeScale,
    initialTestMoveDuration =
      FUNSCRIPT_TEST_CONFIG.initialMoveDurationMs
  }) {
    const buttons = [
      lowPositionButton,
      middlePositionButton,
      highPositionButton,
      testFunscriptButton,
      stopFunscriptButton,
      emergencyStopButton
    ];

    if (
      buttons.some(
        (button) => !(button instanceof HTMLButtonElement)
      )
    ) {
      throw new Error(
        "Un ou plusieurs boutons de contrôle sont invalides."
      );
    }

    if (!(statusElement instanceof HTMLElement)) {
      throw new Error(
        "Le statut de contrôle de l'appareil est invalide."
      );
    }

    const requiredFunctions = {
      getConnected,
      getDevice,
      getClient,
      getActions,
      getVideoSyncRunning,
      pauseVideo,
      stopVideoSync,
      sendPosition,
      stopDevice,
      supportsPositionControl,
      formatError
    };

    for (const [name, value] of Object.entries(
      requiredFunctions
    )) {
      if (typeof value !== "function") {
        throw new Error(`${name} doit être une fonction.`);
      }
    }

    this.lowPositionButton = lowPositionButton;
    this.middlePositionButton = middlePositionButton;
    this.highPositionButton = highPositionButton;
    this.testFunscriptButton = testFunscriptButton;
    this.stopFunscriptButton = stopFunscriptButton;
    this.emergencyStopButton = emergencyStopButton;
    this.statusElement = statusElement;

    this.getConnected = getConnected;
    this.getDevice = getDevice;
    this.getClient = getClient;
    this.getActions = getActions;
    this.getVideoSyncRunning = getVideoSyncRunning;

    this.pauseVideo = pauseVideo;
    this.stopVideoSync = stopVideoSync;
    this.sendPosition = sendPosition;
    this.stopDevice = stopDevice;
    this.supportsPositionControl =
      supportsPositionControl;
    this.formatError = formatError;

    this.minimumPosition = minimumPosition;
    this.maximumPosition = maximumPosition;
    this.manualDuration = manualDuration;
    this.minimumManualDuration = minimumManualDuration;
    this.testTimeScale = testTimeScale;
    this.initialTestMoveDuration =
      initialTestMoveDuration;

    this.deviceCommandInProgress = false;
    this.funscriptTestRunning = false;
    this.funscriptTestCancelled = false;
    this.funscriptWaitTimer = null;
    this.resolveFunscriptWait = null;

    this.registerEvents();
    this.updateButtons();
  }

  updateButtons() {
    const device = this.getDevice();
    const actions = this.getActions();

    const deviceReady =
      this.getConnected() &&
      device !== null &&
      !this.deviceCommandInProgress &&
      !this.funscriptTestRunning &&
      !this.getVideoSyncRunning();

    this.lowPositionButton.disabled = !deviceReady;
    this.middlePositionButton.disabled = !deviceReady;
    this.highPositionButton.disabled = !deviceReady;

    this.testFunscriptButton.disabled =
      !deviceReady ||
      actions.length < 2;

    this.stopFunscriptButton.disabled =
      !this.funscriptTestRunning;

    this.emergencyStopButton.disabled =
      !this.getConnected() ||
      device === null;
  }

  waitForMilliseconds(milliseconds) {
    return new Promise((resolve) => {
      this.resolveFunscriptWait = resolve;

      this.funscriptWaitTimer = window.setTimeout(
        () => {
          this.funscriptWaitTimer = null;
          this.resolveFunscriptWait = null;
          resolve();
        },
        milliseconds
      );
    });
  }

  cancelFunscriptWait() {
    this.funscriptTestCancelled = true;

    if (this.funscriptWaitTimer !== null) {
      window.clearTimeout(this.funscriptWaitTimer);
      this.funscriptWaitTimer = null;
    }

    if (this.resolveFunscriptWait !== null) {
      this.resolveFunscriptWait();
      this.resolveFunscriptWait = null;
    }
  }

  async moveDeviceTo(
    position,
    durationMilliseconds = this.manualDuration
  ) {
    const device = this.getDevice();

    if (
      device === null ||
      this.deviceCommandInProgress
    ) {
      return;
    }

    const safePosition = clamp(position, 0, 1);

    const safeDuration = Math.max(
      this.minimumManualDuration,
      Math.round(durationMilliseconds)
    );

    if (!this.supportsPositionControl(device)) {
      this.statusElement.textContent =
        "The Handy ne signale aucune sortie positionnelle compatible.";

      console.log(
        "Sorties disponibles :",
        device.features.outputs
      );

      return;
    }

    this.deviceCommandInProgress = true;
    this.updateButtons();

    this.statusElement.textContent =
      `Déplacement vers ${Math.round(
        safePosition * 100
      )} %…`;

    try {
      await this.sendPosition(
        safePosition,
        safeDuration
      );

      this.statusElement.textContent =
        `Commande envoyée : ${Math.round(
          safePosition * 100
        )} %.`;
    } catch (error) {
      console.error(
        "Erreur pendant le déplacement :",
        error
      );

      this.statusElement.textContent =
        this.formatError(error);
    } finally {
      this.deviceCommandInProgress = false;
      this.updateButtons();
    }
  }

  async playFunscriptTest() {
    const device = this.getDevice();
    const actions = this.getActions();

    if (
      device === null ||
      this.funscriptTestRunning ||
      actions.length < 2
    ) {
      return;
    }

    this.funscriptTestRunning = true;
    this.funscriptTestCancelled = false;
    this.updateButtons();

    this.statusElement.textContent =
      "Préparation du test funscript…";

    try {
      const firstAction = actions[0];

      const firstNormalizedPosition =
        this.minimumPosition +
        (firstAction.pos / 100) *
          (
            this.maximumPosition -
            this.minimumPosition
          );

      await this.sendPosition(
        firstNormalizedPosition,
        this.initialTestMoveDuration
      );

      await this.waitForMilliseconds(
        this.initialTestMoveDuration
      );

      for (
        let index = 0;
        index < actions.length - 1;
        index += 1
      ) {
        if (this.funscriptTestCancelled) {
          break;
        }

        const currentAction = actions[index];
        const nextAction = actions[index + 1];

        const originalDuration =
          nextAction.at - currentAction.at;

        if (originalDuration <= 0) {
          continue;
        }

        const scaledDuration = Math.max(
          100,
          Math.round(
            originalDuration * this.testTimeScale
          )
        );

        const normalizedTarget =
          this.minimumPosition +
          (nextAction.pos / 100) *
            (
              this.maximumPosition -
              this.minimumPosition
            );

        this.statusElement.textContent =
          `Test funscript : action ${index + 2} / ` +
          `${actions.length}`;

        await this.sendPosition(
          normalizedTarget,
          scaledDuration
        );

        await this.waitForMilliseconds(
          scaledDuration
        );
      }

      this.statusElement.textContent =
        this.funscriptTestCancelled
          ? "Test funscript interrompu."
          : "Test funscript terminé.";
    } catch (error) {
      console.error(
        "Erreur pendant le test funscript :",
        error
      );

      this.statusElement.textContent =
        this.formatError(error);
    } finally {
      this.funscriptTestRunning = false;
      this.funscriptTestCancelled = false;
      this.funscriptWaitTimer = null;
      this.resolveFunscriptWait = null;
      this.updateButtons();
    }
  }

  async stopSelectedDevice() {
    const device = this.getDevice();

    if (device === null) {
      return;
    }

    this.statusElement.textContent =
      "Arrêt de l’appareil…";

    const result = await this.stopDevice(
      device,
      this.getClient()
    );

    this.statusElement.textContent =
      result.message;
  }

  async stopFunscriptTest() {
    this.cancelFunscriptWait();

    try {
      await this.stopSelectedDevice();

      this.statusElement.textContent =
        "Test funscript arrêté.";
    } catch (error) {
      console.error(
        "Erreur pendant l'arrêt du test :",
        error
      );
    } finally {
      this.updateButtons();
    }
  }

  async emergencyStop() {
    this.pauseVideo();
    this.cancelFunscriptWait();

    await this.stopVideoSync({
      stopDevice: false
    });

    await this.stopSelectedDevice();

    this.statusElement.textContent =
      "Arrêt d'urgence effectué.";
  }

  handleConnectionLost() {
    this.deviceCommandInProgress = false;
    this.cancelFunscriptWait();
    this.funscriptTestRunning = false;
    this.updateButtons();
  }

  registerEvents() {
    this.lowPositionButton.addEventListener(
      "click",
      () => void this.moveDeviceTo(
        this.minimumPosition,
        this.manualDuration
      )
    );

    this.middlePositionButton.addEventListener(
      "click",
      () => void this.moveDeviceTo(
        0.5,
        this.manualDuration
      )
    );

    this.highPositionButton.addEventListener(
      "click",
      () => void this.moveDeviceTo(
        this.maximumPosition,
        this.manualDuration
      )
    );

    this.testFunscriptButton.addEventListener(
      "click",
      () => void this.playFunscriptTest()
    );

    this.stopFunscriptButton.addEventListener(
      "click",
      () => void this.stopFunscriptTest()
    );

    this.emergencyStopButton.addEventListener(
      "click",
      () => void this.emergencyStop()
    );
  }
}
