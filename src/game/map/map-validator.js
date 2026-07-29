"use strict";

const VIDEO_TYPES = new Set(["normal", "elite", "boss", "hidden"]);
const NON_VIDEO_TYPES = new Set(["event", "shop", "campfire", "special"]);
const FALLBACK_DURATION_MINUTES = Object.freeze({ normal:3.5, elite:5, boss:7, hidden:3.5 });
const EXPECTED_GOLD = Object.freeze({
  warmup:27.5, easy:32.5, normal:37.5, hard:50,
  eliteEasy:57.5, eliteNormal:65, eliteHard:80,
  event:15
});

function getNodeMap(map) {
  return new Map(map.nodes.map((node) => [node.id, node]));
}

export function getAllRoutes(map, { includeHidden = false } = {}) {
  const nodesById = getNodeMap(map);
  const startNode = nodesById.get(map.startNodeId);
  const routes = [];
  if (!startNode) return routes;
  function visit(node, route, visited) {
    if (visited.has(node.id)) return;
    const nextRoute = [...route, node];
    if (node.id === map.bossNodeId) {
      routes.push(nextRoute);
      return;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(node.id);
    for (const nextNodeId of node.nextNodeIds ?? []) {
      const nextNode = nodesById.get(nextNodeId);
      if (!nextNode || (!includeHidden && nextNode.hidden === true)) continue;
      visit(nextNode, nextRoute, nextVisited);
    }
  }
  visit(startNode, [], new Set());
  return routes;
}

function countType(route, type) {
  return route.filter((node) => node.type === type).length;
}

function getMaximumConsecutive(route, predicate) {
  let maximum = 0;
  let current = 0;
  for (const node of route) {
    if (predicate(node)) {
      current += 1;
      maximum = Math.max(maximum, current);
    } else {
      current = 0;
    }
  }
  return maximum;
}

export function estimateNodeDurationMinutes(node = {}) {
  if (node.type === "event" && node.hasVideo === true) {
    return Number(node.estimatedDurationMinutes) || 3.5;
  }
  return FALLBACK_DURATION_MINUTES[node.type] ?? 0;
}

export function estimateRouteDurationMinutes(route) {
  return route.reduce((total, node) => total + estimateNodeDurationMinutes(node), 0);
}

function estimateNodeGold(node) {
  if (node.type === "normal") return EXPECTED_GOLD[node.difficulty] ?? 37.5;
  if (node.type === "elite") {
    const difficulty = String(node.difficulty ?? "normal");
    const key = `elite${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    return EXPECTED_GOLD[key] ?? 65;
  }
  if (node.type === "event") return Number(node.expectedGold ?? EXPECTED_GOLD.event);
  return 0;
}

export function estimateRouteGold(route, startingGold = 50) {
  return route.reduce((total, node) => total + estimateNodeGold(node), startingGold);
}

function hasNormalBeforeFirstElite(route) {
  const firstEliteIndex = route.findIndex((node) => node.type === "elite");
  if (firstEliteIndex < 0) return false;
  return route.slice(0, firstEliteIndex).some((node) => node.type === "normal");
}

function hasPunishingPreBossSequence(route) {
  const playable = route.filter((node) => node.type !== "start");
  const tail = playable.slice(-3);
  return tail.length === 3 &&
    tail[0]?.type === "normal" && tail[0]?.difficulty === "hard" &&
    tail[1]?.type === "elite" && tail[1]?.difficulty === "hard" &&
    tail[2]?.type === "boss";
}

function validateRoute(route, routeIndex, rowCount) {
  const errors = [];
  const playableNodes = route.filter((node) => node.type !== "start");
  const firstPlayableNode = playableNodes[0] ?? null;
  const lastNode = route.at(-1) ?? null;
  const normalCount = countType(route, "normal");
  const eliteCount = countType(route, "elite");
  const eventCount = countType(route, "event");
  const shopCount = countType(route, "shop");
  const campfireCount = countType(route, "campfire");
  const durationMinutes = estimateRouteDurationMinutes(route);
  const expectedGold = estimateRouteGold(route);
  const firstThirdEnd = Math.floor((rowCount - 1) / 3);
  const lastThirdStart = Math.ceil((rowCount - 1) * 2 / 3);
  const prefix = `Route ${routeIndex + 1}`;

  if (firstPlayableNode?.difficulty !== "warmup") errors.push(`${prefix} : le premier choix n’est pas un Warm-up.`);
  if (lastNode?.type !== "boss") errors.push(`${prefix} : la route ne se termine pas par le boss.`);
  if (normalCount < 4 || normalCount > 8) errors.push(`${prefix} : ${normalCount} rencontres normales au lieu de 4 à 8.`);
  if (eliteCount < 1 || eliteCount > 3) errors.push(`${prefix} : ${eliteCount} élites au lieu de 1 à 3.`);
  if (eventCount > 3) errors.push(`${prefix} : ${eventCount} événements au lieu d’un maximum de 3.`);
  if (shopCount > 2) errors.push(`${prefix} : ${shopCount} boutiques au lieu d’un maximum de 2.`);
  if (campfireCount > 2) errors.push(`${prefix} : ${campfireCount} feux de camp au lieu d’un maximum de 2.`);
  if (!hasNormalBeforeFirstElite(route)) errors.push(`${prefix} : aucune rencontre normale ne précède le premier élite.`);
  if (getMaximumConsecutive(route, (node) => node.type === "normal") > 3) errors.push(`${prefix} : plus de trois rencontres normales consécutives.`);
  if (getMaximumConsecutive(route, (node) => node.type === "elite") > 1) errors.push(`${prefix} : deux élites consécutifs.`);
  if (getMaximumConsecutive(route, (node) => node.type === "shop") > 1) errors.push(`${prefix} : deux boutiques consécutives.`);
  if (getMaximumConsecutive(route, (node) => node.type === "campfire") > 1) errors.push(`${prefix} : deux feux de camp consécutifs.`);
  if (getMaximumConsecutive(route, (node) => NON_VIDEO_TYPES.has(node.type) && !(node.type === "event" && node.hasVideo)) > 2) errors.push(`${prefix} : plus de deux cases sans vidéo consécutives.`);
  if (getMaximumConsecutive(route, (node) => VIDEO_TYPES.has(node.type) || (node.type === "event" && node.hasVideo)) > 3) errors.push(`${prefix} : plus de trois cases vidéo consécutives.`);
  if (route.some((node) => node.type === "elite" && node.row <= 2)) errors.push(`${prefix} : un élite apparaît dans les deux premières rangées.`);
  if (route.some((node) => (node.type === "normal" || node.type === "elite") && node.difficulty === "hard" && node.row <= firstThirdEnd)) errors.push(`${prefix} : une rencontre difficile apparaît dans le premier tiers.`);
  if (route.some((node) => node.type === "normal" && node.difficulty === "easy" && node.row >= lastThirdStart)) errors.push(`${prefix} : une rencontre facile apparaît trop près du boss.`);
  if (getMaximumConsecutive(route, (node) => node.type === "normal" && node.difficulty === "hard") > 2) errors.push(`${prefix} : plus de deux rencontres difficiles consécutives.`);
  if (hasPunishingPreBossSequence(route)) errors.push(`${prefix} : séquence difficile, élite difficile, boss imposée avant la fin.`);
  if (durationMinutes < 30 || durationMinutes > 45) errors.push(`${prefix} : durée estimée de ${durationMinutes.toFixed(1)} minutes au lieu de 30 à 45.`);
  if (expectedGold < 300 || expectedGold > 460) errors.push(`${prefix} : économie estimée à ${expectedGold.toFixed(0)} pièces au lieu de 300 à 460.`);

  return {
    valid: errors.length === 0,
    errors,
    counts: { normal:normalCount, elite:eliteCount, event:eventCount, shop:shopCount, campfire:campfireCount },
    durationMinutes,
    expectedGold,
    nodeIds: route.map((node) => node.id)
  };
}

function countMeaningfulBranches(map) {
  let count = 0;
  for (const node of map.nodes) {
    if (node.hidden === true || (node.nextNodeIds?.length ?? 0) < 2) continue;
    if (new Set(node.nextNodeIds).size >= 2) count += 1;
  }
  return count;
}

function validateGraphCoverage(map, errors) {
  const nodesById = getNodeMap(map);
  const incoming = new Map(map.nodes.map((node) => [node.id, 0]));
  for (const node of map.nodes) {
    for (const nextId of node.nextNodeIds ?? []) {
      if (!nodesById.has(nextId)) errors.push(`La connexion ${node.id} → ${nextId} pointe vers une case inexistante.`);
      else incoming.set(nextId, (incoming.get(nextId) ?? 0) + 1);
    }
  }
  for (const node of map.nodes) {
    if (node.hidden === true || node.id === map.startNodeId) continue;
    if ((incoming.get(node.id) ?? 0) === 0) errors.push(`La case ${node.id} est inaccessible.`);
    if (node.id !== map.bossNodeId && !(node.nextNodeIds?.length)) errors.push(`La case ${node.id} est un chemin mort.`);
  }
}

export function validateMap(map) {
  const errors = [];
  if (!map || !Array.isArray(map.nodes) || !Array.isArray(map.rows)) {
    return { valid:false, errors:["La structure de carte est invalide."], routes:[] };
  }
  if (map.rows.length < 10 || map.rows.length > 14) errors.push(`La carte contient ${map.rows.length} rangées au lieu de 10 à 14.`);
  if (map.rows[0]?.length !== 1 || map.rows[0]?.[0]?.type !== "start") errors.push("La première rangée doit uniquement contenir le départ.");
  if (map.rows.at(-1)?.length !== 1 || map.rows.at(-1)?.[0]?.type !== "boss") errors.push("La dernière rangée doit uniquement contenir le boss.");
  if (map.rows.slice(1, -1).some((row) => row.length < 3)) errors.push("Les rangées intermédiaires doivent conserver les trois chemins principaux.");

  validateGraphCoverage(map, errors);
  const routes = getAllRoutes(map);
  if (!routes.length) errors.push("Aucune route ne relie le départ au boss.");
  const routeResults = routes.map((route, index) => validateRoute(route, index, map.rows.length));
  for (const result of routeResults) errors.push(...result.errors);

  const meaningfulBranches = countMeaningfulBranches(map);
  if (meaningfulBranches < 2) errors.push(`La carte ne contient que ${meaningfulBranches} embranchement(s) réel(s), au lieu d’au moins 2.`);

  const signatures = new Set(routes.map((route) => route.map((node) => `${node.type}:${node.difficulty ?? "-"}`).join("|")));
  if (routes.length > 1 && signatures.size < 3) errors.push("Les trois chemins principaux ne proposent pas assez de parcours différents.");

  const routeGoldValues = routeResults.map((route) => route.expectedGold).filter(Number.isFinite);
  if (routeGoldValues.length > 1) {
    const minimum = Math.min(...routeGoldValues);
    const maximum = Math.max(...routeGoldValues);
    if (minimum > 0 && maximum / minimum > 1.25) errors.push(`L’écart économique entre les routes dépasse 25 % (${minimum.toFixed(0)} à ${maximum.toFixed(0)} pièces).`);
  }

  const eventIds = map.nodes.filter((node) => node.type === "event").map((node) => node.eventId);
  if (eventIds.some((eventId) => !eventId)) errors.push("Une case événement ne possède aucun événement réel.");
  if (new Set(eventIds).size !== eventIds.length) errors.push("Un même événement est utilisé plusieurs fois sur la carte.");

  const hiddenNodes = map.nodes.filter((node) => node.hidden === true);
  if (hiddenNodes.length > 1) errors.push("La carte contient plus d’une rencontre cachée.");
  if (hiddenNodes.some((node) => (node.rewardGold ?? 0) !== 0)) errors.push("La rencontre cachée ne doit donner aucune récompense directe.");
  if (hiddenNodes.some((node) => node.mediaType !== "secret")) errors.push("La rencontre cachée doit sélectionner exclusivement le catalogue média secret.");
  if (hiddenNodes.some((node) => node.encounterId)) errors.push("La rencontre cachée ne doit pas réutiliser une rencontre normale ou élite codée en dur.");

  return {
    valid: errors.length === 0,
    errors,
    routes: routeResults,
    routeCount: routes.length,
    meaningfulBranches,
    rowCount: map.rows.length
  };
}
