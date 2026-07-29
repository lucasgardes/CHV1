"use strict";

import { EVENTS } from "../../data/events.js";
import { validateMap } from "./map-validator.js";

const MIN_ROWS = 10;
const MAX_ROWS = 14;
const LANES = Object.freeze([0, 1, 2]);
const TYPE_WEIGHTS = Object.freeze([
  { value: "normal", weight: 40 },
  { value: "event", weight: 20 },
  { value: "elite", weight: 12 },
  { value: "campfire", weight: 12 },
  { value: "shop", weight: 10 },
  { value: "special", weight: 6 }
]);
const TITLES = Object.freeze({
  start: "Départ", normal: "Rencontre normale", event: "Événement mystère",
  elite: "Élite", shop: "Boutique", campfire: "Feu de camp",
  special: "Salle spéciale", hidden: "Rencontre cachée", boss: "Boss final"
});
const ENCOUNTER_IDS = Object.freeze({ normal:["normal-001","normal-002"], elite:["elite-001"], boss:["boss-001"] });

function normalizeSeed(seed) { return Number.isInteger(seed) ? seed >>> 0 : Date.now() >>> 0; }
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
function randomInteger(minimum, maximum, random) { return minimum + Math.floor(random() * (maximum - minimum + 1)); }
function pick(values, random) { return values[Math.floor(random() * values.length)]; }
function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
function pickWeighted(entries, random) {
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
  let cursor = random() * totalWeight;
  for (const entry of entries) { cursor -= entry.weight; if (cursor <= 0) return entry.value; }
  return entries.at(-1).value;
}

function getNormalDifficulty(row, rowCount, random) {
  if (row === 1) return "warmup";
  const progress = row / (rowCount - 1);
  if (progress <= 0.34) return pickWeighted([{value:"easy",weight:75},{value:"normal",weight:25}], random);
  if (progress <= 0.67) return pickWeighted([{value:"easy",weight:15},{value:"normal",weight:70},{value:"hard",weight:15}], random);
  return pickWeighted([{value:"normal",weight:45},{value:"hard",weight:55}], random);
}
function getEliteDifficulty(row, rowCount, random) {
  const progress = row / (rowCount - 1);
  if (progress <= 0.34) return pickWeighted([{value:"easy",weight:65},{value:"normal",weight:30},{value:"hard",weight:5}], random);
  if (progress <= 0.67) return pickWeighted([{value:"easy",weight:30},{value:"normal",weight:50},{value:"hard",weight:20}], random);
  return pickWeighted([{value:"easy",weight:10},{value:"normal",weight:45},{value:"hard",weight:45}], random);
}
function getRewardGold(type, difficulty, random) {
  const ranges = type === "normal"
    ? {warmup:[25,30],easy:[30,35],normal:[35,40],hard:[45,55]}
    : {easy:[50,65],normal:[55,75],hard:[70,90]};
  const range = ranges[difficulty];
  return range ? randomInteger(range[0], range[1], random) : 0;
}

function createNode({ row, lane, type, rowCount, random, eventId = null }) {
  const node = { id:type === "start" ? "start" : `row-${row}-lane-${lane}`, row, lane, type, title:TITLES[type], nextNodeIds:[] };
  if (type === "normal") {
    node.difficulty = getNormalDifficulty(row, rowCount, random);
    node.encounterId = pick(ENCOUNTER_IDS.normal, random);
    node.rewardGold = getRewardGold(type, node.difficulty, random);
  } else if (type === "elite") {
    node.difficulty = getEliteDifficulty(row, rowCount, random);
    node.encounterId = pick(ENCOUNTER_IDS.elite, random);
    node.rewardGold = getRewardGold(type, node.difficulty, random);
  } else if (type === "boss") {
    node.difficulty = "boss"; node.encounterId = pick(ENCOUNTER_IDS.boss, random); node.rewardGold = 0;
  } else if (type === "event") node.eventId = eventId;
  else if (type === "shop") node.shopId = `shop-${row}-${lane}`;
  else if (type === "campfire") node.campfireId = `campfire-${row}-${lane}`;
  else if (type === "special") node.specialId = `special-${row}-${lane}`;
  return node;
}
function chooseEventId(availableEventIds, random, eventWeights = null) {
  if (!availableEventIds.length) return null;
  if (!eventWeights) return availableEventIds.splice(Math.floor(random() * availableEventIds.length), 1)[0];

  const availableByTone = new Map();
  for (const eventId of availableEventIds) {
    const tone = EVENTS.find((event) => event.id === eventId)?.tone;
    if (!tone) continue;
    if (!availableByTone.has(tone)) availableByTone.set(tone, []);
    availableByTone.get(tone).push(eventId);
  }
  const weightedTones = Object.entries(eventWeights)
    .map(([value, weight]) => ({value, weight:Math.max(0, Number(weight) || 0)}))
    .filter((entry) => entry.weight > 0 && availableByTone.get(entry.value)?.length);
  if (!weightedTones.length) return availableEventIds.splice(Math.floor(random() * availableEventIds.length), 1)[0];

  const selectedTone = pickWeighted(weightedTones, random);
  const pool = availableByTone.get(selectedTone);
  const selectedId = pool[Math.floor(random() * pool.length)];
  availableEventIds.splice(availableEventIds.indexOf(selectedId), 1);
  return selectedId;
}
function isVideoType(type) { return type === "normal" || type === "elite"; }
function isSafeTypeSequence(types) {
  if (types[0] !== "normal") return false;
  const eliteIndex = types.indexOf("elite");
  if (eliteIndex < 2) return false;
  let videoRun = 0;
  let normalRun = 0;
  for (const type of types) {
    videoRun = isVideoType(type) ? videoRun + 1 : 0;
    normalRun = type === "normal" ? normalRun + 1 : 0;
    if (videoRun > 3 || normalRun > 3) return false;
  }
  let trailingVideos = 0;
  for (let index = types.length - 1; index >= 0 && isVideoType(types[index]); index -= 1) trailingVideos += 1;
  return trailingVideos <= 2;
}
function createRowTypePlan(rowCount, random) {
  const intermediateCount = rowCount - 2;
  const nonVideoCount = intermediateCount <= 9 ? 2 : Math.min(4, intermediateCount - 7);
  const normalCount = intermediateCount - nonVideoCount - 1;
  const tokens = [...Array(normalCount).fill("normal"), "elite", ...Array(nonVideoCount).fill("non-video")];
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const candidate = shuffle(tokens, random);
    if (isSafeTypeSequence(candidate)) return candidate;
  }
  const templates = {
    8:["normal","normal","non-video","normal","elite","non-video","normal","normal"],
    9:["normal","normal","non-video","normal","elite","normal","non-video","normal","normal"],
    10:["normal","normal","non-video","normal","elite","normal","non-video","normal","non-video","normal"],
    11:["normal","normal","non-video","normal","elite","normal","non-video","normal","normal","non-video","normal"],
    12:["normal","normal","non-video","normal","elite","normal","non-video","normal","normal","non-video","normal","normal"]
  };
  return templates[intermediateCount];
}
function pickNonVideoType(availableEventIds, random) {
  const entries = [{value:"event",weight:20},{value:"campfire",weight:12},{value:"shop",weight:10},{value:"special",weight:6}]
    .filter((entry) => entry.value !== "event" || availableEventIds.length > 0);
  const type = pickWeighted(entries, random);
  if (type !== "special") return type;
  return availableEventIds.length > 0 && random() < 0.5 ? "event" : "campfire";
}
function assignNodeTypes({ rowCount, random, eventWeights = null }) {
  const assignments = new Map();
  const availableEventIds = shuffle(EVENTS.map((event) => event.id), random);
  const rowTypePlan = createRowTypePlan(rowCount, random);
  for (let row = 1; row < rowCount - 1; row += 1) {
    const plannedType = rowTypePlan[row - 1];
    for (const lane of LANES) {
      const type = plannedType === "non-video" ? pickNonVideoType(availableEventIds, random) : plannedType;
      const eventId = type === "event" ? chooseEventId(availableEventIds, random, eventWeights) : null;
      assignments.set(`${row}:${lane}`, { type, eventId });
    }
  }
  return assignments;
}

function nodeAddConnection(source, target) { if (target && !source.nextNodeIds.includes(target.id)) source.nextNodeIds.push(target.id); }
function connectRows(currentRowNodes, nextRowNodes, random) {
  for (const node of currentRowNodes) node.nextNodeIds = [];
  for (const source of currentRowNodes) {
    const sameLane = nextRowNodes.find((target) => target.lane === source.lane);
    nodeAddConnection(source, sameLane ?? pick(nextRowNodes, random));
  }
  for (const source of shuffle(currentRowNodes, random)) {
    const candidates = shuffle(nextRowNodes.filter((target) => !source.nextNodeIds.includes(target.id) && Math.abs(target.lane - source.lane) <= 1), random);
    const extraCount = random() < 0.62 ? 1 : (random() < 0.12 ? 2 : 0);
    for (const target of candidates.slice(0, extraCount)) nodeAddConnection(source, target);
  }
  for (const target of nextRowNodes) {
    if (currentRowNodes.some((source) => source.nextNodeIds.includes(target.id))) continue;
    const closest = [...currentRowNodes].sort((left, right) => Math.abs(left.lane - target.lane) - Math.abs(right.lane - target.lane))[0];
    nodeAddConnection(closest, target);
  }
}
function createHiddenEncounter({ rows, nodes, random }) {
  const possibleRows = [];
  for (let row = 3; row <= rows.length - 3; row += 1) possibleRows.push(row);
  const row = pick(possibleRows, random);
  const sourceNode = pick(rows[row - 1], random);
  const targetNode = pick(rows[row + 1], random);
  const hiddenNode = {
    id:"hidden-encounter", row, lane:1, type:"hidden", mediaType:"secret", title:TITLES.hidden,
    difficulty:pick(["easy","normal","hard"], random), encounterId:null, rewardGold:0,
    hidden:true, optional:true, nextNodeIds:[targetNode.id]
  };
  nodes.push(hiddenNode);
  return {nodeId:hiddenNode.id,sourceNodeId:sourceNode.id,targetNodeId:targetNode.id};
}
function generateCandidateMap(seed, eventWeights) {
  const random = createSeededRandom(seed);
  const rowCount = randomInteger(MIN_ROWS, MAX_ROWS, random);
  const assignments = assignNodeTypes({rowCount,random,eventWeights});
  const rows = [];
  const nodes = [];
  const start = createNode({row:0,lane:1,type:"start",rowCount,random});
  rows.push([start]); nodes.push(start);
  for (let row = 1; row < rowCount - 1; row += 1) {
    const rowNodes = LANES.map((lane) => createNode({row,lane,rowCount,random,...assignments.get(`${row}:${lane}`)}));
    rows.push(rowNodes); nodes.push(...rowNodes);
  }
  const boss = createNode({row:rowCount - 1,lane:1,type:"boss",rowCount,random});
  rows.push([boss]); nodes.push(boss);
  for (let row = 0; row < rows.length - 1; row += 1) connectRows(rows[row], rows[row + 1], random);
  const hiddenConnection = createHiddenEncounter({rows,nodes,random});
  return {seed,rows,nodes,startNodeId:"start",bossNodeId:boss.id,hiddenConnection,eventWeights:eventWeights ? {...eventWeights} : null};
}
export function generateMap({ seed, maximumAttempts = 1000, eventWeights = null } = {}) {
  const initialSeed = normalizeSeed(seed);
  let lastValidation = null;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const candidateSeed = (initialSeed + attempt) >>> 0;
    const map = generateCandidateMap(candidateSeed, eventWeights);
    const validation = validateMap(map);
    if (validation.valid) {
      map.validation = validation;
      map.generationAttempts = attempt + 1;
      return map;
    }
    lastValidation = validation;
  }
  const details = lastValidation?.errors.slice(0, 8).join(" | ") ?? "Erreur inconnue";
  throw new Error(`Impossible de générer une carte valide après ${maximumAttempts} tentatives : ${details}`);
}