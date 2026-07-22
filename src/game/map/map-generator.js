"use strict";

const ROW_LANES = Object.freeze([
  [1],
  [0, 2],
  [0, 1, 2],
  [0, 2],
  [0, 1, 2],
  [1],
  [0, 2],
  [0, 1, 2],
  [0, 2],
  [1],
  [1]
]);

const TITLES = Object.freeze({
  start: "Départ",
  normal: "Rencontre normale",
  event: "Événement mystère",
  elite: "Élite",
  boss: "Boss final"
});

const ENCOUNTER_IDS = Object.freeze({
  normal: ["normal-001", "normal-002"],
  elite: ["elite-001"],
  boss: ["boss-001"]
});

function createSeededRandom(seed) {
  let state = Number.isInteger(seed) ? seed >>> 0 : Date.now() >>> 0;

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

function getNodeType({ row, lane, previousType, random }) {
  if (row === 0) {
    return "start";
  }

  if (row === ROW_LANES.length - 1) {
    return "boss";
  }

  if (row === 8) {
    return "elite";
  }

  if (row === 1 || row === 9) {
    return "normal";
  }

  const candidates = ["normal", "normal", "event"];

  if (row >= 3 && row <= 7 && previousType !== "elite") {
    candidates.push("elite");
  }

  const filtered = candidates.filter((type) => {
    if (type === "event" && previousType === "event") {
      return false;
    }

    if (type === "elite" && previousType === "elite") {
      return false;
    }

    return true;
  });

  const type = pick(filtered, random);

  if (lane === 1 && row === 5) {
    return "normal";
  }

  return type;
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

  if (type === "normal" || type === "elite" || type === "boss") {
    node.encounterId = pick(ENCOUNTER_IDS[type], random);
  }

  if (type === "event") {
    node.eventId = "event-001";
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

export function generateMap({ seed } = {}) {
  const random = createSeededRandom(seed);
  const rows = [];
  const nodes = [];

  for (let row = 0; row < ROW_LANES.length; row += 1) {
    const rowNodes = ROW_LANES[row].map((lane) => {
      const previousRow = rows[row - 1] ?? [];
      const previousNode = previousRow.find((node) => node.lane === lane) ?? previousRow[0] ?? null;
      const type = getNodeType({
        row,
        lane,
        previousType: previousNode?.type ?? null,
        random
      });

      return createNode({ row, lane, type, random });
    });

    rows.push(rowNodes);
    nodes.push(...rowNodes);
  }

  for (let row = 0; row < rows.length - 1; row += 1) {
    connectRows(rows[row], rows[row + 1]);
  }

  return {
    seed: Number.isInteger(seed) ? seed : null,
    rows,
    nodes,
    startNodeId: "start",
    bossNodeId: rows.at(-1)[0].id
  };
}
