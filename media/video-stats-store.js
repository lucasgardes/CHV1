"use strict";

function createEmptyStats() {
  return {
    schemaVersion: 1,
    global: {
      totalStarted: 0,
      totalCompleted: 0,
      totalWins: 0,
      totalLosses: 0,
      totalItemsUsed: 0,
      totalWatchSeconds: 0
    },
    videos: {}
  };
}

function ensureVideo(stats, videoId) {
  if (!stats.videos[videoId]) {
    stats.videos[videoId] = {
      started: 0,
      completed: 0,
      wins: 0,
      losses: 0,
      itemsUsed: 0,
      watchSeconds: 0,
      bestProgressPercent: 0,
      progressPercentTotal: 0,
      progressSamples: 0,
      lastPlayedAt: null,
      items: {},
      byDifficulty: {}
    };
  }
  return stats.videos[videoId];
}

function ensureDifficulty(video, difficulty) {
  const key = String(difficulty || "default");
  if (!video.byDifficulty[key]) video.byDifficulty[key] = { started: 0, completed: 0, wins: 0, losses: 0, itemsUsed: 0, watchSeconds: 0 };
  return video.byDifficulty[key];
}

function applyPlaybackEvent(stats, event = {}) {
  if (!stats || typeof stats !== "object") stats = createEmptyStats();
  if (event.playbackContext !== "run" && event.playbackContext !== "event") return stats;
  const videoId = String(event.videoId || "").trim();
  if (!videoId) return stats;
  const video = ensureVideo(stats, videoId);
  const difficulty = ensureDifficulty(video, event.difficulty);
  const now = event.at || new Date().toISOString();
  const watchSeconds = Math.max(0, Number(event.watchSeconds) || 0);
  const progress = Math.max(0, Math.min(100, Number(event.progressPercent) || 0));

  if (event.type === "start") {
    stats.global.totalStarted += 1;
    video.started += 1;
    difficulty.started += 1;
    video.lastPlayedAt = now;
  } else if (event.type === "item-used") {
    const itemId = String(event.itemId || "unknown");
    stats.global.totalItemsUsed += 1;
    video.itemsUsed += 1;
    difficulty.itemsUsed += 1;
    video.items[itemId] = (video.items[itemId] || 0) + 1;
  } else if (event.type === "win" || event.type === "loss") {
    stats.global.totalCompleted += 1;
    stats.global.totalWatchSeconds += watchSeconds;
    video.completed += 1;
    video.watchSeconds += watchSeconds;
    difficulty.completed += 1;
    difficulty.watchSeconds += watchSeconds;
    video.bestProgressPercent = Math.max(video.bestProgressPercent, progress);
    video.progressPercentTotal += progress;
    video.progressSamples += 1;
    if (event.type === "win") {
      stats.global.totalWins += 1;
      video.wins += 1;
      difficulty.wins += 1;
    } else {
      stats.global.totalLosses += 1;
      video.losses += 1;
      difficulty.losses += 1;
    }
  }
  return stats;
}

function summarizeStats(stats) {
  const videos = Object.entries(stats?.videos || {}).map(([id, entry]) => ({
    id,
    ...entry,
    winrate: entry.completed ? entry.wins / entry.completed : 0,
    averageItemsUsed: entry.started ? entry.itemsUsed / entry.started : 0,
    averageProgressPercent: entry.progressSamples ? entry.progressPercentTotal / entry.progressSamples : 0
  }));
  const sortDesc = (key) => [...videos].sort((a, b) => b[key] - a[key]);
  return {
    global: stats?.global || createEmptyStats().global,
    mostViewed: sortDesc("started").slice(0, 10),
    mostItemsUsed: sortDesc("itemsUsed").slice(0, 10),
    bestWinrate: [...videos].filter((v) => v.completed > 0).sort((a, b) => b.winrate - a.winrate || b.completed - a.completed).slice(0, 10),
    worstWinrate: [...videos].filter((v) => v.completed > 0).sort((a, b) => a.winrate - b.winrate || b.completed - a.completed).slice(0, 10),
    videos
  };
}

module.exports = { createEmptyStats, applyPlaybackEvent, summarizeStats };
