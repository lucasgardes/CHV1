"use strict";

import test from "node:test";
import assert from "node:assert/strict";

class FakeVideoElement {
  constructor() {
    this.src = "";
    this.ended = false;
    this.paused = true;
    this.style = {};
  }
  pause() { this.paused = true; }
  load() {}
  async play() { this.paused = false; }
}

globalThis.HTMLVideoElement = FakeVideoElement;

const [
  { GameState },
  { ItemController },
  { RoomController },
  { EncounterController },
  { MapController },
  { getItemById }
] = await Promise.all([
  import("../src/game/game-state.js"),
  import("../src/game/item-controller.js"),
  import("../src/game/room-controller.js"),
  import("../src/game/encounter-controller.js"),
  import("../src/game/map/map-controller.js"),
  import("../src/data/items.js")
]);

function createRoomHarness({ inventory = [], upgraded = [], gold = 1000, row = 0 } = {}) {
  const gameState = new GameState();
  gameState.status = "shop";
  gameState.gold = gold;
  gameState.inventory = [...inventory];
  gameState.upgradedItemIds = [...upgraded];
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  const shopView = { render() {}, hide() {} };
  const campfireView = { hide() {}, show() {}, setUpgradeableItems() {}, setCampfireContext() {} };
  const controller = new RoomController({
    gameState,
    itemController,
    shopView,
    campfireView,
    onRoomCompleted() {}
  });
  controller.currentNode = { id: `shop-${row}`, type: "shop", row };
  return { gameState, itemController, controller };
}

function createEncounterHarness({ inventory = [], upgraded = [], encounter } = {}) {
  const gameState = new GameState();
  gameState.status = "encounter";
  gameState.inventory = [...inventory];
  gameState.upgradedItemIds = [...upgraded];
  const itemController = new ItemController({ gameState });
  itemController.resetForRun();
  const video = new FakeVideoElement();
  const sourceEncounter = encounter ?? {
    id: "normal-test",
    title: "Test",
    type: "normal",
    difficulty: "normal",
    rewardGold: 100,
    videoPath: "test.mp4",
    funscripts: { normal: "test.funscript" }
  };
  const controller = new EncounterController({
    gameState,
    itemController,
    video,
    getEncounterById(id) { return id === sourceEncounter.id ? sourceEncounter : null; },
    async stopVideoSync() {},
    setFunscriptPath() {},
    async loadFunscript() {},
    resetActions() {},
    resolveFunscript() {
      return {
        difficulty: sourceEncounter.difficulty,
        requestedDifficulty: sourceEncounter.difficulty,
        path: "test.funscript",
        fallbackUsed: false
      };
    }
  });
  return { gameState, itemController, controller, encounter: sourceEncounter };
}

test("Habitué des boutiques applique sa réduction normale et améliorée", () => {
  const normal = createRoomHarness({ inventory: ["shop-regular"] });
  const upgraded = createRoomHarness({ inventory: ["shop-regular"], upgraded: ["shop-regular"] });
  const item = getItemById("time-out");
  assert.equal(normal.controller.getItemPrice(item), 125);
  assert.equal(upgraded.controller.getItemPrice(item), 120);
});

test("Client fidèle ne réduit que les premiers achats configurés", () => {
  const normal = createRoomHarness({ inventory: ["faithful-customer"] });
  const state = normal.controller.getShopState();
  assert.equal(normal.controller.getShopDiscount(state), 0.2);
  state.purchaseCount = 1;
  assert.equal(normal.controller.getShopDiscount(state), 0);

  const upgraded = createRoomHarness({ inventory: ["faithful-customer"], upgraded: ["faithful-customer"] });
  const upgradedState = upgraded.controller.getShopState();
  upgradedState.purchaseCount = 1;
  assert.equal(upgraded.controller.getShopDiscount(upgradedState), 0.2);
  upgradedState.purchaseCount = 2;
  assert.equal(upgraded.controller.getShopDiscount(upgradedState), 0);
});

test("Programme de fidélité cumule sa réduction jusqu'au plafond", () => {
  const { controller } = createRoomHarness({ inventory: ["loyalty-program"] });
  const state = controller.getShopState();
  state.loyaltyDiscount = 0.05;
  assert.equal(controller.getShopDiscount(state), 0.05);
  state.loyaltyDiscount = 0.2;
  assert.equal(controller.getShopDiscount(state), 0.2);
});

test("Stock privilégié ajoute un emplacement, y compris amélioré", () => {
  const normal = createRoomHarness({ inventory: ["privileged-stock"] });
  const upgraded = createRoomHarness({ inventory: ["privileged-stock"], upgraded: ["privileged-stock"] });
  assert.equal(normal.controller.getStockSize(), 4);
  assert.equal(upgraded.controller.getStockSize(), 4);
  assert.equal(normal.controller.getRareChance(true), 0.05);
  assert.equal(upgraded.controller.getRareChance(true), 0.15);
});

test("Pièce porte-bonheur et Jeton maudit cumulent leurs chances rares", () => {
  const normal = createRoomHarness({ inventory: ["lucky-coin", "cursed-token"] });
  assert.equal(normal.controller.getRareChance(false), 0.21);

  const upgraded = createRoomHarness({
    inventory: ["lucky-coin", "cursed-token"],
    upgraded: ["lucky-coin", "cursed-token"]
  });
  assert.equal(upgraded.controller.getRareChance(false), 0.33);
});

test("les réductions de boutique cumulées restent plafonnées à 35 %", () => {
  const { controller } = createRoomHarness({
    inventory: ["shop-regular", "faithful-customer", "loyalty-program"],
    upgraded: ["shop-regular", "faithful-customer", "loyalty-program"]
  });
  const state = controller.getShopState();
  state.loyaltyDiscount = 0.3;
  assert.equal(controller.getShopDiscount(state), 0.35);
});

test("Montre cassée réduit uniquement les rencontres normales", async () => {
  const normal = createEncounterHarness({ inventory: ["broken-watch"] });
  const loadedNormal = await normal.controller.load(normal.encounter.id);
  assert.equal(loadedNormal.durationAdjustmentSeconds, -30);

  const eliteEncounter = { ...normal.encounter, id: "elite-test", type: "elite" };
  const elite = createEncounterHarness({ inventory: ["broken-watch"], encounter: eliteEncounter });
  const loadedElite = await elite.controller.load(eliteEncounter.id);
  assert.equal(loadedElite.durationAdjustmentSeconds, 0);
});

test("Sablier doré réduit toutes les catégories de rencontres", async () => {
  for (const type of ["normal", "elite", "boss"]) {
    const encounter = {
      id: `${type}-test`, title: "Test", type, difficulty: type === "boss" ? "boss" : "normal",
      rewardGold: 100, videoPath: "test.mp4", funscripts: { normal: "test.funscript", boss: "test.funscript" }
    };
    const { controller } = createEncounterHarness({ inventory: ["golden-hourglass"], encounter });
    const loaded = await controller.load(encounter.id);
    assert.equal(loaded.durationAdjustmentSeconds, -15);
  }
});

test("Chasseur d’élites et Pari du clown modifient ensemble durée et récompense", async () => {
  const encounter = {
    id: "elite-test", title: "Élite", type: "elite", difficulty: "normal",
    rewardGold: 100, videoPath: "test.mp4", funscripts: { normal: "test.funscript" }
  };
  const { controller } = createEncounterHarness({ inventory: ["elite-hunter", "clown-bet"], encounter });
  const loaded = await controller.load(encounter.id);
  assert.equal(loaded.durationAdjustmentSeconds, 10);
  assert.equal(loaded.effectiveRewardGold, 200);
});

test("Confiance excessive raccourcit les normales et rallonge le boss", async () => {
  const normal = createEncounterHarness({ inventory: ["overconfidence"] });
  assert.equal((await normal.controller.load(normal.encounter.id)).durationAdjustmentSeconds, -25);

  const bossEncounter = {
    ...normal.encounter,
    id: "boss-test",
    type: "boss",
    difficulty: "boss",
    funscripts: { boss: "test.funscript" }
  };
  const boss = createEncounterHarness({ inventory: ["overconfidence"], encounter: bossEncounter });
  assert.equal((await boss.controller.load(bossEncounter.id)).durationAdjustmentSeconds, 45);
});

test("Porte-monnaie percé retire de l'or à chaque déplacement", () => {
  const gameState = new GameState();
  gameState.startRun("start");
  gameState.inventory = ["leaky-wallet"];
  gameState.gold = 50;
  const mapController = new MapController({ gameState, seed: 12345 });
  const destination = mapController.getAccessibleNodes()[0];
  mapController.moveToNode(destination.id);
  assert.equal(gameState.gold, 42);
});
