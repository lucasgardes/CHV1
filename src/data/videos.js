"use strict";

export const VIDEOS = Object.freeze([
  {
    id: "normal-001",
    title: "Rencontre normale 1",
    type: "normal",
    videoPath: "../assets/videos/test-video.mp4",
    funscriptPath: "../assets/funscripts/test-video.funscript",
    difficulty: 1,
    rewardGold: 35
  },
  {
    id: "normal-002",
    title: "Rencontre normale 2",
    type: "normal",
    videoPath: "../assets/videos/test-video.mp4",
    funscriptPath: "../assets/funscripts/test-video.funscript",
    difficulty: 2,
    rewardGold: 38
  },
  {
    id: "elite-001",
    title: "Rencontre élite",
    type: "elite",
    videoPath: "../assets/videos/test-video.mp4",
    funscriptPath: "../assets/funscripts/test-video.funscript",
    difficulty: 3,
    rewardGold: 65
  },
  {
    id: "boss-001",
    title: "Boss final",
    type: "boss",
    videoPath: "../assets/videos/test-video.mp4",
    funscriptPath: "../assets/funscripts/test-video.funscript",
    difficulty: 5,
    rewardGold: 0
  }
]);

export function getVideoById(videoId) {
  return VIDEOS.find(
    (video) => video.id === videoId
  ) ?? null;
}