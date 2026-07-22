"use strict";

import {
  validateMap
} from "./map-validator.js";

const ROW_LANES = Object.freeze([
  [1],
  [0, 2],
  [0, 1, 2],
  [0, 1, 2],
  [0, 2],
  [0, 1, 2],
  [1],
  [0, 1, 2],
  [0, 2],
  [0, 1, 2],
  [0, 1, 2],
  [0, 2],
  [1]
]);

const FIXED_ROW_TYPES = Object.freeze({
  0: "start",
  1: "normal",
  2: "normal",
  4: "normal",
  6: "elite",
  8: "normal",
  10: "normal",
  11: "normal",
  12: "boss"
});

const FLEXIBLE_TYPES = Object.freeze([
  "event",
  "event",
  "shop",
  "campfire",
  "normal"
]);

const TITLES = Object.freeze({
  start: "Départ",
  normal: "Rencontre normale",
  event: "Événement mystère",
  elite: "Élite",
  shop: "Boutique",
  campfire: "Feu de camp",
  hidden: "Rencontre cachée",
  boss: "Boss final"
});

const ENCOUNTER_IDS = Object.freeze({
  normal: ["normal-001", "normal-002"],
  elite: ["elite-001"],
  boss: ["boss-001"],
  hidden: ["normal-001", "normal-002", "elite-001"]
});

function normalizeSeed(seed) {
  return Number.isInteger(seed) ? seed >>> 0 : Date.now() >>> 0;
}

function createSeededRandom(seed) {
  let state = normalizeSeed(seed);

  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function pickWeighted(entries, random) {
  const totalWeight = entries.reduce((total, entry) => {
    return total + entry.weight;
  }, 0);
  let cursor = random() * totalWeight;

  for (const entry of entries) {
    cursor -= entry.weight;

    if (cursor <= 0) {
      return entry.value;
    }
  }

  return entries.at(-1).value;
}

function getNormalDifficulty(row, random) {
  if (row === 1) {
    return "warmup";
  }

  if (row <= 4) {
    return pickWeighted([
      { value: "easy", weight: 75 },
      { value: "normal", weight: 25 }
    ], random);
  }

  if (row <= 8) {
    return pickWeighted([
      { value: "easy", weight: 15 },
      { value: "normal", weight: 70 },
      { value: "hard", weight: 15 }
    ], random);
  }

  return pickWeighted([
    { value: "normal", weight: 45 },
    { value: "hard", weight: 55 }
  ], random);
}

function getEliteDifficulty(row, random) {
  if (row <= 4) {
    return pickWeighted([
      { value: "easy", weight: 65 },
      { value: "normal", weight: 30 },
      { value: "hard", weight: 5 }
    ], random);
  }

  if (row <= 8) {
    return pickWeighted([
      { value: "easy", weight: 30 },
      { value: "normal", weight: 50 },
      { value: "hard", weight: 20 }
    ], random);
  }

  return pickWeighted([
    { value: "easy", weight: 10 },
    { value: "normal", weight: 45 },
    { value: "hard", weight: 45 }
  ], random);
}

function getNodeType({ row, lane, random }) {
  const fixedType = FIXED_ROW_TYPES[row];

  if (fixedType) {
    return fixedType;
  }

  const type = pick(FLEXIBLE_TYPES, random);

  if (row === 3 && lane === 0) {
    return "event";
  }

  if (row === 3 && lane === 2) {
    return "shop";
  }

  if (row === 5 && lane === 1) {
    return "campfire";
  }

  if (row === 7 && lane === 0) {
    return "shop";
  }

  if (row === 9 && lane === 2) {
    return "campfire";
  }

  return type;
}

function getRewardGold(type, difficulty, random) {
  if (type === "normal") {
    const ranges = {
      warmup: [25, 30],
      easy: [30, 35],
      normal: [35, 40],
      hard: [45, 55]
    };
    const [minimum, maximum] = ranges[difficulty];
    return Math.floor(minimum + random() * (maximum - minimum + 1));
  }

  if (type === "elite") {
    const ranges = {
      easy: [50, 65],
      normal: [55, 75],
      hard: [70, 90]
    };
    const [minimum, maximum] = ranges[difficulty];
    return Math.floor(minimum + random() * (maximum - minimum + 1));
  }

  return 0;
}

function createNode({ row, lane, type, random }) {
  const node = {
    id: type === "start" ? "start" : `row-${row}-lane-${lane}`,
    row,
    lane,
    type,
    title: TITLES[type],
    nextNodeIds: []
  };

  if (type === "normal") {
    node.difficulty = getNormalDifficulty(row, random);
    node.encounterId = pick(ENCOUNTER_IDS.normal, random);
    node.rewardGold = getRewardGold(type, node.difficulty, random);
  }

  if (type === "elite") {
    node.difficulty = getEliteDifficulty(row, random);
    node.encounterId = pick(ENCOUNTER_IDS.elite, random);
    node.rewardGold = getRewardGold(type, node.difficulty, random);
  }

  if (type === "boss") {
    node.difficulty = "boss";
    node.encounterId = pick(ENCOUNTER_IDS.boss, random);
    node.rewardGold = 0;
  }

  if (type === "event") {
    node.eventId = "event-001";
  }

  if (type === "shop") {
    node.shopId = `shop-${row}-${lane}`;
  }

  if (type === "campfire") {
    node.campfireId = `campfire-${row}-${lane}`;
  }

  return node;
}

function connectRows(currentRowNodes, nextRowNodes) {
  for (const node of currentRowNodes) {
    const sortedTargets = [...nextRowNodes].sort((left, right) => {
      return Math.abs(left.lane - node.lane) - Math.abs(right.lane - node.lane);
    });
    const closestDistance = Math.abs(sortedTargets[0].lane - node.lane);
    const targets = sortedTargets.filter((target) => {
      return Math.abs(target.lane - node.lane) <= closestDistance + 1;
    });

    node.nextNodeIds = targets.slice(0, 2).map((target) => target.id);
  }

  for (const target of nextRowNodes) {
    const hasIncomingConnection = currentRowNodes.some((node) => {
      return node.nextNodeIds.includes(target.id);
    });

    if (!hasIncomingConnection) {
      const closestSource = [...currentRowNodes].sort((left, right) => {
        return Math.abs(left.lane - target.lane) - Math.abs(right.lane - target.lane);
      })[0];

      closestSource.nextNodeIds.push(target.id);
    }
  }
}

function createHiddenEncounter({ rows, nodes, random }) {
  const possibleRows = [3, 5, 7, 9];
  const row = pick(possibleRows, random);
  const lane = 1;
  const sourceRow = rows[row - 1];
  const targetRow = rows[row + 1];
  const sourceNode = pick(sourceRow, random);
  const targetNode = [...targetRow].sort((left, right) => {
    return Math.abs(left.lane - lane) - Math.abs(right.lane - lane);
  })[0];
  const difficulty = pick(["easy", "normal", "hard"], random);
  const hiddenNode = {
    id: "hidden-encounter",
    row,
    lane,
    type: "hidden",
    title: TITLES.hidden,
    difficulty,
    encounterId: pick(ENCOUNTER_IDS.hidden, random),
    rewardGold: 0,
    hidden: true,
    optional: true,
    nextNodeIds: [targetNode.id]
  };

  nodes.push(hiddenNode);

  return {
    nodeId: hiddenNode.id,
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id
  };
}

function generateCandidateMap(seed) {
  const random = createSeededRandom(seed);
  const rows = [];
  const nodes = [];

  for (let row = 0; row < ROW_LANES.length; row += 1) {
    const rowNodes = ROW_LANES[row].map((lane) => {
      const type = getNodeType({ row, lane, random });
      return createNode({ row, lane, type, random });
    });

    rows.push(rowNodes);
    nodes.push(...rowNodes);
  }

  for (let row = 0; row < rows.length - 1; row += 1) {
    connectRows(rows[row], rows[row + 1]);
  }

  const hiddenConnection = createHiddenEncounter({
    rows,
    nodes,
    random
  });

  return {
    seed,
    rows,
    nodes,
    startNodeId: "start",
    bossNodeId: rows.at(-1)[0].id,
    hiddenConnection
  };
}

export function generateMap({ seed, maximumAttempts = 200 } = {}) {
  const initialSeed = normalizeSeed(seed);
  let lastValidation = null;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const candidateSeed = (initialSeed + attempt) >>> 0;
    const map = generateCandidateMap(candidateSeed);
    const validation = validateMap(map);

    if (validation.valid) {
      map.validation = validation;
      map.generationAttempts = attempt + 1;
      return map;
    }

    lastValidation = validation;
  }

  const details = lastValidation?.errors.slice(0, 5).join(" | ") ?? "Erreur inconnue";
  throw new Error(
    `Impossible de générer une carte valide après ${maximumAttempts} tentatives : ${details}`
  );
}
