"use strict";

import {
  calculatePositionAtTime,
  findNextActionIndex,
  mapFunscriptPositionToDevice
} from "./funscript.js";

import {
  DEVICE_CONFIG,
  VIDEO_CONFIG
} from "./config.js";

export class VideoFunscriptSynchronizer {
  constructor({
    video,
    getActions,
    getDevice,
    sendPosition,
    stopDeviceSilently,
    minimumPosition = DEVICE_CONFIG.minimumPosition,
    maximumPosition = DEVICE_CONFIG.maximumPosition,
    syncLookAheadMs = VIDEO_CONFIG.syncLookAheadMs,
    syncTimerPaddingMs = VIDEO_CONFIG.syncTimerPaddingMs,
    freezeMoveDurationMs = VIDEO_CONFIG.freezeMoveDurationMs,
    freezeSettleDelayMs = VIDEO_CONFIG.freezeSettleDelayMs,
    onStateChange = () => {},
    onStatusChange = () => {},
    onError = () => {}
  }) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Le lecteur vidéo fourni est invalide.");
    }

    if (typeof getActions !== "function") {
      throw new Error("getActions doit être une fonction.");
    }

    if (typeof getDevice !== "function") {
      throw new Error("getDevice doit être une fonction.");
    }

    if (typeof sendPosition !== "function") {
      throw new Error("sendPosition doit être une fonction.");
    }

    if (typeof stopDeviceSilently !== "function") {
      throw new Error(
        "stopDeviceSilently doit être une fonction."
      );
    }

    this.video = video;
    this.getActions = getActions;
    this.getDevice = getDevice;
    this.sendPosition = sendPosition;
    this.stopDeviceSilently = stopDeviceSilently;

    this.minimumPosition = minimumPosition;
    this.maximumPosition = maximumPosition;
    this.syncLookAheadMs = syncLookAheadMs;
    this.syncTimerPaddingMs = syncTimerPaddingMs;
    this.freezeMoveDurationMs = freezeMoveDurationMs;
    this.freezeSettleDelayMs = freezeSettleDelayMs;

    this.onStateChange = onStateChange;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    this.timer = null;
    this.generation = 0;
    this.running = false;
  }

  get state() {
    return {
      running: this.running
    };
  }

  emitState() {
    this.onStateChange(this.state);
  }

  clearTimer() {
    if (this.timer === null) {
      return;
    }

    window.clearTimeout(this.timer);
    this.timer = null;
  }

  cancel() {
    this.generation += 1;
    this.running = false;
    this.clearTimer();
    this.emitState();
  }

  async freezeAtCurrentPosition() {
    const device = this.getDevice();
    const actions = this.getActions();

    if (device === null || actions.length === 0) {
      return;
    }

    const currentTimeMilliseconds =
      this.video.currentTime * 1000;

    const result = calculatePositionAtTime(
      actions,
      currentTimeMilliseconds
    );

    const currentDevicePosition =
      mapFunscriptPositionToDevice(
        result.position,
        this.minimumPosition,
        this.maximumPosition
      );

    try {
      await this.sendPosition(
        currentDevicePosition,
        this.freezeMoveDurationMs
      );

      await new Promise((resolve) => {
        window.setTimeout(
          resolve,
          this.freezeSettleDelayMs
        );
      });

      await this.stopDeviceSilently();
    } catch (error) {
      this.onError(
        "Impossible de figer l'appareil",
        error
      );

      await this.stopDeviceSilently();
    }
  }

  async scheduleNextAction(generation) {
    const actions = this.getActions();
    const device = this.getDevice();

    if (
      generation !== this.generation ||
      !this.running ||
      this.video.paused ||
      this.video.ended ||
      device === null ||
      actions.length < 2
    ) {
      return;
    }

    const currentTimeMilliseconds =
      this.video.currentTime * 1000;

    const nextActionIndex = findNextActionIndex(
      actions,
      currentTimeMilliseconds + this.syncLookAheadMs
    );

    if (nextActionIndex === -1) {
      this.running = false;
      this.emitState();
      this.onStatusChange("Fin du funscript atteinte.");
      return;
    }

    const nextAction = actions[nextActionIndex];

    const remainingDuration = Math.max(
      100,
      Math.round(
        nextAction.at - currentTimeMilliseconds
      )
    );

    const targetPosition =
      mapFunscriptPositionToDevice(
        nextAction.pos,
        this.minimumPosition,
        this.maximumPosition
      );

    this.onStatusChange(
      `Synchronisation vidéo : action ` +
      `${nextActionIndex + 1} / ${actions.length}`
    );

    try {
      await this.sendPosition(
        targetPosition,
        remainingDuration
      );
    } catch (error) {
      this.running = false;
      this.emitState();

      this.onError(
        "Erreur pendant la synchronisation vidéo",
        error
      );
      return;
    }

    if (
      generation !== this.generation ||
      !this.running ||
      this.video.paused ||
      this.video.ended
    ) {
      return;
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.scheduleNextAction(generation);
    }, remainingDuration + this.syncTimerPaddingMs);
  }

  async start() {
    this.clearTimer();

    this.generation += 1;
    const generation = this.generation;

    const actions = this.getActions();
    const device = this.getDevice();

    if (
      device === null ||
      actions.length < 2 ||
      this.video.paused ||
      this.video.ended
    ) {
      this.running = false;
      this.emitState();
      return;
    }

    await this.stopDeviceSilently();

    if (
      generation !== this.generation ||
      this.video.paused ||
      this.video.ended
    ) {
      return;
    }

    this.running = true;
    this.emitState();

    await this.scheduleNextAction(generation);
  }

  async stop({
    stopDevice = true,
    freezeAtCurrentPosition = false
  } = {}) {
    this.generation += 1;
    this.running = false;
    this.clearTimer();
    this.emitState();

    if (!stopDevice) {
      return;
    }

    if (freezeAtCurrentPosition) {
      await this.freezeAtCurrentPosition();
    } else {
      await this.stopDeviceSilently();
    }
  }
}
