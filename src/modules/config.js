"use strict";

export const APP_CONFIG = Object.freeze({
  intifaceClientName: "CHV1",
  intifaceVerbose: true
});

export const DEVICE_CONFIG = Object.freeze({
  minimumPosition: 0.15,
  maximumPosition: 0.85,
  manualMoveDurationMs: 2000,
  minimumManualMoveDurationMs: 250,
  minimumCommandDurationMs: 100
});

export const FUNSCRIPT_TEST_CONFIG = Object.freeze({
  timeScale: 2,
  initialMoveDurationMs: 1500
});

export const VIDEO_CONFIG = Object.freeze({
  seekStepSeconds: 5,
  syncLookAheadMs: 5,
  syncTimerPaddingMs: 10,
  freezeMoveDurationMs: 100,
  freezeSettleDelayMs: 120
});

export const FUNSCRIPT_VIEW_CONFIG = Object.freeze({
  simulatorHeightPx: 260,
  positionMarkerHeightPx: 52
});
