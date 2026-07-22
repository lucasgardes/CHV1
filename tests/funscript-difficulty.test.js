"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../src/game/game-state.js";
import {
  FUNSCRIPT_DIFFICULTIES,
  resolveFunscriptSelection,
  shiftFunscriptDifficulty
} from "../src/game/funscript-difficulty.js";

const encounter = {
  id: "test",
  defaultFunscriptDifficulty: FUNSCRIPT_DIFFICULTIES.MEDIUM,
  funscripts: {
    easy: "easy.funscript",
    medium: "medium.funscript",
    hard: "hard.funscript"
  }
};

test("shiftFunscriptDifficulty reste dans les limites", () => {
  assert.equal(shiftFunscriptDifficulty("easy", -1), "easy");
  assert.equal(shiftFunscriptDifficulty("medium", -1), "easy");
  assert.equal(shiftFunscriptDifficulty("medium", 1), "hard");
  assert.equal(shiftFunscriptDifficulty("hard", 1), "hard");
});

test("la difficulté par défaut sélectionne le bon fichier", () => {
  const gameState = new GameState();
  const result = resolveFunscriptSelection({ encounter, gameState });

  assert.equal(result.difficulty, "medium");
  assert.equal(result.path, "medium.funscript");
  assert.equal(result.fallbackUsed, false);
});

test("une réduction en attente ne concerne que la prochaine rencontre", () => {
  const gameState = new GameState();
  gameState.queueNextFunscriptDifficultyShift(-1);

  const first = resolveFunscriptSelection({ encounter, gameState });
  const second = resolveFunscriptSelection({ encounter, gameState });

  assert.equal(first.difficulty, "easy");
  assert.equal(second.difficulty, "medium");
});

test("Contrat de surchauffe augmente la difficulté au chargement", () => {
  const gameState = new GameState();
  gameState.addItem("overheat-contract");

  const result = resolveFunscriptSelection({ encounter, gameState });
  assert.equal(result.difficulty, "hard");
});

test("Batterie possédée peut choisir le niveau supérieur", () => {
  const gameState = new GameState();
  gameState.addItem("possessed-battery");

  const result = resolveFunscriptSelection({
    encounter,
    gameState,
    random: () => 0
  });

  assert.equal(result.difficulty, "hard");
});

test("un fichier moyen sert de repli lorsqu’une variante manque", () => {
  const gameState = new GameState();
  gameState.queueNextFunscriptDifficultyShift(1);

  const result = resolveFunscriptSelection({
    encounter: {
      ...encounter,
      funscripts: { medium: "medium-only.funscript" }
    },
    gameState
  });

  assert.equal(result.requestedDifficulty, "hard");
  assert.equal(result.difficulty, "medium");
  assert.equal(result.path, "medium-only.funscript");
  assert.equal(result.fallbackUsed, true);
});
