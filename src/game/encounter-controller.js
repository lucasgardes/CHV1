"use strict";

import {
  GAME_STATUS
} from "./game-state.js";

export class EncounterController {
  constructor({
    gameState,
    itemController,
    video,
    getEncounterById,
    stopVideoSync,
    setFunscriptPath,
    loadFunscript,
    onActionsReset = () => {},
    onEncounterLoaded = () => {},
    onNormalCompleted = () => {},
    onEliteCompleted = () => {},
    onBossCompleted = () => {},
    onPlaybackFallback = () => {},
    onState