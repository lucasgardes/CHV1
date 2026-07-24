"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmptyStats, applyPlaybackEvent, summarizeStats } = require("../media/video-stats-store.js");

test("la lecture Collection ne modifie jamais les statistiques", () => {
  const stats = createEmptyStats();
  applyPlaybackEvent(stats, { type:"start", videoId:"video-a", playbackContext:"collection" });
  assert.equal(stats.global.totalStarted, 0);
  assert.deepEqual(stats.videos, {});
});

test("une rencontre enregistre lancement, objet et victoire par difficulté", () => {
  const stats = createEmptyStats();
  applyPlaybackEvent(stats, { type:"start", videoId:"video-a", difficulty:"hard", playbackContext:"run" });
  applyPlaybackEvent(stats, { type:"item-used", videoId:"video-a", difficulty:"hard", itemId:"time-out", playbackContext:"run" });
  applyPlaybackEvent(stats, { type:"win", videoId:"video-a", difficulty:"hard", watchSeconds:180, progressPercent:100, playbackContext:"run" });
  assert.equal(stats.global.totalStarted, 1);
  assert.equal(stats.global.totalWins, 1);
  assert.equal(stats.global.totalItemsUsed, 1);
  assert.equal(stats.videos["video-a"].byDifficulty.hard.wins, 1);
  assert.equal(stats.videos["video-a"].items["time-out"], 1);
});

test("les classements calculent correctement le winrate", () => {
  const stats = createEmptyStats();
  applyPlaybackEvent(stats, { type:"start", videoId:"a", playbackContext:"run" });
  applyPlaybackEvent(stats, { type:"win", videoId:"a", playbackContext:"run", progressPercent:100 });
  applyPlaybackEvent(stats, { type:"start", videoId:"b", playbackContext:"run" });
  applyPlaybackEvent(stats, { type:"loss", videoId:"b", playbackContext:"run", progressPercent:50 });
  const summary = summarizeStats(stats);
  assert.equal(summary.bestWinrate[0].id, "a");
  assert.equal(summary.worstWinrate[0].id, "b");
});
