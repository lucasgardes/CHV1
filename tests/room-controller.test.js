import test from "node:test";
import assert from "node:assert/strict";

import { GameState, GAME_STATUS } from "../src/game/game-state.js";
import { ItemController } from "../src/game/item-controller.js";
import { RoomController } from "../src/game/room-controller.js";

function createRoom() {
  const gameState = new GameState();
  gameState.startRun();
  gameState.gold = 1000;
  const itemController = new ItemController({ gameState });
  const shopRenders = [];
  const campfireRenders = [];
  let completed = 0;

  const shopView = {
    render(payload) { shopRenders.push(payload); },
    hide() {}
  };
  const campfireView = {
    setUpgradeableItems(items) { campfireRenders.push(items); },
    show() {},
    hide() {}
  };

  const room = new RoomController({
    gameState,
    itemController,
    shopView,
    campfireView,
    onRoomCompleted() { completed += 1; }
  });

  return {
    gameState,
    itemController,
    room,
    shopRenders,
    campfireRenders,
    get completed() { return completed; }
  };
}

test("la boutique ne propose pas les objets déjà possédés", () => {
  const context = createRoom();
  context.gameState.addItem("time-out");
  context.room.open({ id: "shop-1", type: "shop", row: 3 });

  const renderedIds = context.shopRenders.at(-1).items.map(({ item }) => item.id);
  assert.equal(renderedIds.includes("time-out"), false);
  assert.equal(new Set(renderedIds).size, renderedIds.length);
});

test("un achat retire l'or et ajoute l'objet", () => {
  const context = createRoom();
  context.room.open({ id: "shop-1", type: "shop", row: 0 });
  const first = context.shopRenders.at(-1).items[0];
  const previousGold = context.gameState.gold;

  assert.equal(context.room.buyItem(first.item.id), true);
  assert.equal(context.gameState.hasItem(first.item.id), true);
  assert.equal(context.gameState.gold, previousGold - first.price);
});

test("le feu de camp améliore un objet une seule fois", () => {
  const context = createRoom();
  context.gameState.addItem("time-out");
  context.gameState.moveToNode("camp-1");
  context.room.open({ id: "camp-1", type: "campfire", row: 5 });

  assert.equal(context.room.upgradeItem("time-out"), true);
  assert.equal(context.gameState.isItemUpgraded("time-out"), true);
  assert.equal(context.gameState.status, GAME_STATUS.MAP);
  assert.equal(context.room.upgradeItem("time-out"), false);
});

test("le repos recharge et termine la salle", () => {
  const context = createRoom();
  context.gameState.addItem("time-out");
  context.gameState.moveToNode("camp-1");
  context.itemController.activate("time-out");
  context.itemController.consumeCharge("time-out");
  context.itemController.finishActivation("time-out");
  context.room.open({ id: "camp-1", type: "campfire", row: 5 });

  context.room.rest();
  assert.equal(context.itemController.isAvailable("time-out"), true);
  assert.equal(context.gameState.status, GAME_STATUS.MAP);
  assert.equal(context.completed, 1);
});
