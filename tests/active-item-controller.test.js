import test from "node:test";
import assert from "node:assert/strict";

class FakeVideoElement {
  constructor() {
    this.paused = false;
    this.ended = false;
    this.muted = false;
    this.style = { opacity: "" };
    this.playCalls = 0;
    this.pauseCalls = 0;
  }

  pause() {
    this.paused = true;
    this.pauseCalls += 1;
  }

  async play() {
    this.paused = false;
    this.playCalls += 1;
  }
}

globalThis.HTMLVideoElement = FakeVideoElement;
globalThis.window = { setTimeout };

const { GameState, GAME_STATUS } = await import("../src/game/game-state.js");
const { ItemController } = await import("../src/game/item-controller.js");
const { ActiveItemController } = await import("../src/game/active-item-controller.js");

function createController(itemId) {
  const gameState = new GameState();
  gameState.startRun();
  gameState.setStatus(GAME_STATUS.ENCOUNTER);
  gameState.addItem(itemId);
  const itemController = new ItemController({ gameState });
  const video = new FakeVideoElement();
  const statuses = [];
  const active = new ActiveItemController({
    gameState,
    itemController,
    video,
    wait: async () => {},
    onStatusChange(message) { statuses.push(message); }
  });

  return { gameState, itemController, video, active, statuses };
}

test("un objet de pause reprend la vidéo une seule fois", async () => {
  const context = createController("cracked-stopwatch");
  await context.active.use("cracked-stopwatch");
  assert.equal(context.video.pauseCalls, 1);
  assert.equal(context.video.playCalls, 1);
  assert.equal(context.itemController.isActive("cracked-stopwatch"), false);
});

test("le silencieux restaure l'état sonore précédent", async () => {
  const context = createController("silencer");
  context.video.muted = true;
  await context.active.use("silencer");
  assert.equal(context.video.muted, true);
});

test("l'écran de fumée restaure l'opacité précédente", async () => {
  const context = createController("smoke-screen");
  context.video.style.opacity = "0.8";
  await context.active.use("smoke-screen");
  assert.equal(context.video.style.opacity, "0.8");
});

test("l'annulation empêche une ancienne minuterie de reprendre la vidéo", async () => {
  const context = createController("time-out");
  let release;
  context.active.wait = () => new Promise((resolve) => { release = resolve; });

  const operation = context.active.use("time-out");
  await Promise.resolve();
  context.gameState.setStatus(GAME_STATUS.MAP);
  context.active.cancelActiveEffect();
  release();
  await operation;

  assert.equal(context.video.playCalls, 0);
  assert.equal(context.itemController.isActive("time-out"), false);
});
