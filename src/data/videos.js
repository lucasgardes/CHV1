"use strict";

import { FUNSCRIPT_DIFFICULTIES } from "../game/funscript-difficulty.js";

const TEST_FUNSCRIPT_PATH = "../assets/funscripts/test-video.funscript";
function createTestFunscripts() {
  return Object.freeze({
    [FUNSCRIPT_DIFFICULTIES.EASY]: TEST_FUNSCRIPT_PATH,
    [FUNSCRIPT_DIFFICULTIES.MEDIUM]: TEST_FUNSCRIPT_PATH,
    [FUNSCRIPT_DIFFICULTIES.HARD]: TEST_FUNSCRIPT_PATH
  });
}

export const VIDEOS = Object.freeze([
  {
    id:"normal-001", title:"Rencontre normale 1", type:"normal",
    videoPath:"../assets/videos/test-video.mp4", funscripts:createTestFunscripts(),
    defaultFunscriptDifficulty:FUNSCRIPT_DIFFICULTIES.EASY,
    difficulty:1, durationSeconds:180, rewardGold:35
  },
  {
    id:"normal-002", title:"Rencontre normale 2", type:"normal",
    videoPath:"../assets/videos/test-video.mp4", funscripts:createTestFunscripts(),
    defaultFunscriptDifficulty:FUNSCRIPT_DIFFICULTIES.MEDIUM,
    difficulty:2, durationSeconds:240, rewardGold:38
  },
  {
    id:"elite-001", title:"Rencontre élite", type:"elite",
    videoPath:"../assets/videos/test-video.mp4", funscripts:createTestFunscripts(),
    defaultFunscriptDifficulty:FUNSCRIPT_DIFFICULTIES.HARD,
    difficulty:3, durationSeconds:300, rewardGold:65
  },
  {
    id:"boss-001", title:"Boss final", type:"boss",
    videoPath:"../assets/videos/test-video.mp4", funscripts:createTestFunscripts(),
    defaultFunscriptDifficulty:FUNSCRIPT_DIFFICULTIES.HARD,
    difficulty:5, durationSeconds:420, rewardGold:0
  }
]);

export function getVideoById(videoId) { return VIDEOS.find((video) => video.id === videoId) ?? null; }
