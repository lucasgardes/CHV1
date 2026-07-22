"use strict";

export const FUNSCRIPT_DIFFICULTIES = Object.freeze({
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard"
});

const ORDERED_DIFFICULTIES = Object.freeze([
  FUNSCRIPT_DIFFICULTIES.EASY,
  FUNSCRIPT_DIFFICULTIES.MEDIUM,
  FUNSCRIPT_DIFFICULTIES.HARD
]);

export function normalizeFunscriptDifficulty(value) {
  return ORDERED_DIFFICULTIES.includes(value)
    ? value
    : FUNSCRIPT_DIFFICULTIES.MEDIUM;
}

export function shiftFunscriptDifficulty(difficulty, amount) {
  const normalized = normalizeFunscriptDifficulty(difficulty);
  const currentIndex = ORDERED_DIFFICULTIES.indexOf(normalized);
  const nextIndex = Math.max(
    0,
    Math.min(ORDERED_DIFFICULTIES.length - 1, currentIndex + amount)
  );

  return ORDERED_DIFFICULTIES[nextIndex];
}

function inferDefaultDifficulty(encounter) {
  if (encounter?.defaultFunscriptDifficulty) {
    return normalizeFunscriptDifficulty(encounter.defaultFunscriptDifficulty);
  }

  const numericDifficulty = Number(encounter?.difficulty);
  if (!Number.isFinite(numericDifficulty)) {
    return FUNSCRIPT_DIFFICULTIES.MEDIUM;
  }

  if (numericDifficulty <= 1) return FUNSCRIPT_DIFFICULTIES.EASY;
  if (numericDifficulty >= 4) return FUNSCRIPT_DIFFICULTIES.HARD;
  return FUNSCRIPT_DIFFICULTIES.MEDIUM;
}

function getPassiveDifficultyShift(gameState, random) {
  let shift = 0;

  if (gameState.hasItem("overheat-contract")) {
    shift += 1;
  }

  if (gameState.hasItem("possessed-battery")) {
    const chance = gameState.isItemUpgraded("possessed-battery") ? 0.2 : 0.15;
    if (random() < chance) shift += 1;
  }

  return shift;
}

function resolveAvailablePath(encounter, requestedDifficulty) {
  const variants = encounter?.funscripts ?? {};
  const requestedPath = variants[requestedDifficulty];

  if (requestedPath) {
    return {
      difficulty: requestedDifficulty,
      path: requestedPath,
      fallbackUsed: false
    };
  }

  const fallbackOrder = [
    FUNSCRIPT_DIFFICULTIES.MEDIUM,
    FUNSCRIPT_DIFFICULTIES.EASY,
    FUNSCRIPT_DIFFICULTIES.HARD
  ];

  for (const difficulty of fallbackOrder) {
    if (variants[difficulty]) {
      return {
        difficulty,
        path: variants[difficulty],
        fallbackUsed: difficulty !== requestedDifficulty
      };
    }
  }

  if (encounter?.funscriptPath) {
    return {
      difficulty: requestedDifficulty,
      path: encounter.funscriptPath,
      fallbackUsed: true
    };
  }

  throw new Error(`Aucun funscript disponible pour la rencontre ${encounter?.id ?? "inconnue"}.`);
}

export function resolveFunscriptSelection({
  encounter,
  gameState,
  random = Math.random
}) {
  if (!encounter) throw new Error("La rencontre est requise.");
  if (!gameState) throw new Error("L’état de partie est requis.");
  if (typeof random !== "function") throw new TypeError("random doit être une fonction.");

  const baseDifficulty = inferDefaultDifficulty(encounter);
  const queuedShift = typeof gameState.consumeNextFunscriptDifficultyShift === "function"
    ? gameState.consumeNextFunscriptDifficultyShift()
    : 0;
  const passiveShift = getPassiveDifficultyShift(gameState, random);
  const requestedDifficulty = shiftFunscriptDifficulty(
    baseDifficulty,
    queuedShift + passiveShift
  );
  const selection = resolveAvailablePath(encounter, requestedDifficulty);

  return {
    ...selection,
    baseDifficulty,
    requestedDifficulty,
    queuedShift,
    passiveShift
  };
}
