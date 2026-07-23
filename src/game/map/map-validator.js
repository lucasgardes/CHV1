"use strict";

const VIDEO_TYPES = new Set(["normal", "elite", "boss", "hidden"]);
const NON_VIDEO_TYPES = new Set(["event", "shop", "campfire"]);
const FALLBACK_DURATION_MINUTES = Object.freeze({ normal:3.5, elite:5, boss:7, hidden:3.5 });

function getNodeMap(map) { return new Map(map.nodes.map((node) => [node.id, node])); }

export function getAllRoutes(map, { includeHidden = false } = {}) {
  const nodesById = getNodeMap(map);
  const startNode = nodesById.get(map.startNodeId);
  const routes = [];
  if (!startNode) return routes;
  function visit(node, route, visited) {
    if (visited.has(node.id)) return;
    const nextRoute = [...route, node];
    if (node.id === map.bossNodeId) { routes.push(nextRoute); return; }
    const nextVisited = new Set(visited); nextVisited.add(node.id);
    for (const nextNodeId of node.nextNodeIds ?? []) {
      const nextNode = nodesById.get(nextNodeId);
      if (!nextNode || (!includeHidden && nextNode.hidden === true)) continue;
      visit(nextNode, nextRoute, nextVisited);
    }
  }
  visit(startNode, [], new Set());
  return routes;
}

function countType(route, type) { return route.filter((node) => node.type === type).length; }
function getMaximumConsecutive(route, predicate) {
  let maximum = 0; let current = 0;
  for (const node of route) { if (predicate(node)) { current += 1; maximum = Math.max(maximum, current); } else current = 0; }
  return maximum;
}

export function estimateNodeDurationMinutes(node = {}) {
  const explicitSeconds = Number(node.durationSeconds ?? node.videoDurationSeconds ?? node.eventVideoDurationSeconds);
  if (Number.isFinite(explicitSeconds) && explicitSeconds > 0) return explicitSeconds / 60;
  if (node.type === "event" && node.hasVideo === true) return Number(node.estimatedDurationMinutes) || 3.5;
  return FALLBACK_DURATION_MINUTES[node.type] ?? 0;
}

export function estimateRouteDurationMinutes(route) {
  return route.reduce((total, node) => total + estimateNodeDurationMinutes(node), 0);
}

function hasPunishingPreBossSequence(route) {
  const playable = route.filter((node) => node.type !== "start");
  const tail = playable.slice(-3);
  return tail.length === 3 && tail[0]?.type === "normal" && tail[0]?.difficulty === "hard" && tail[1]?.type === "elite" && tail[1]?.difficulty === "hard" && tail[2]?.type === "boss";
}

function validateRoute(route, routeIndex) {
  const errors = [];
  const playableNodes = route.filter((node) => node.type !== "start");
  const firstPlayableNode = playableNodes[0] ?? null;
  const lastNode = route.at(-1) ?? null;
  const normalCount = countType(route, "normal");
  const eliteCount = countType(route, "elite");
  const durationMinutes = estimateRouteDurationMinutes(route);
  const prefix = `Route ${routeIndex + 1}`;

  if (firstPlayableNode?.difficulty !== "warmup") errors.push(`${prefix} : le premier choix n’est pas un Warm-up.`);
  if (lastNode?.type !== "boss") errors.push(`${prefix} : la route ne se termine pas par le boss.`);
  if (normalCount < 4 || normalCount > 8) errors.push(`${prefix} : ${normalCount} rencontres normales au lieu de 4 à 8.`);
  if (eliteCount < 1 || eliteCount > 3) errors.push(`${prefix} : ${eliteCount} élites au lieu de 1 à 3.`);
  if (getMaximumConsecutive(route, (node) => node.type === "normal") > 3) errors.push(`${prefix} : plus de trois rencontres normales consécutives.`);
  if (getMaximumConsecutive(route, (node) => node.type === "elite") > 1) errors.push(`${prefix} : deux élites consécutifs.`);
  if (getMaximumConsecutive(route, (node) => node.type === "shop") > 1) errors.push(`${prefix} : deux boutiques consécutives.`);
  if (getMaximumConsecutive(route, (node) => node.type === "campfire") > 1) errors.push(`${prefix} : deux feux de camp consécutifs.`);
  if (getMaximumConsecutive(route, (node) => NON_VIDEO_TYPES.has(node.type) && !(node.type === "event" && node.hasVideo)) > 2) errors.push(`${prefix} : plus de deux cases sans vidéo consécutives.`);
  if (getMaximumConsecutive(route, (node) => VIDEO_TYPES.has(node.type) || (node.type === "event" && node.hasVideo)) > 3) errors.push(`${prefix} : plus de trois cases vidéo consécutives.`);
  if (route.some((node) => node.type === "elite" && node.row <= 2)) errors.push(`${prefix} : un élite apparaît dans les deux premières rangées.`);
  if (route.some((node) => (node.type === "normal" || node.type === "elite") && node.difficulty === "hard" && node.row <= 4)) errors.push(`${prefix} : une rencontre difficile apparaît dans le premier tiers.`);
  if (route.some((node) => node.type === "normal" && node.difficulty === "easy" && node.row >= 9)) errors.push(`${prefix} : une rencontre facile apparaît trop près du boss.`);
  if (getMaximumConsecutive(route, (node) => node.type === "normal" && node.difficulty === "hard") > 2) errors.push(`${prefix} : plus de deux rencontres difficiles consécutives.`);
  if (hasPunishingPreBossSequence(route)) errors.push(`${prefix} : séquence difficile, élite difficile, boss imposée avant la fin.`);
  if (durationMinutes < 30 || durationMinutes > 45) errors.push(`${prefix} : durée estimée de ${durationMinutes.toFixed(1)} minutes au lieu de 30 à 45.`);

  return {
    valid: errors.length === 0,
    errors,
    counts: { normal:normalCount, elite:eliteCount, event:countType(route,"event"), shop:countType(route,"shop"), campfire:countType(route,"campfire") },
    durationMinutes,
    nodeIds: route.map((node) => node.id)
  };
}

export function validateMap(map) {
  const errors = [];
  if (!map || !Array.isArray(map.nodes) || !Array.isArray(map.rows)) return { valid:false, errors:["La structure de carte est invalide."], routes:[] };
  if (map.rows.length !== 13) errors.push(`La carte contient ${map.rows.length} rangées au lieu de 13.`);
  const routes = getAllRoutes(map);
  if (!routes.length) errors.push("Aucune route ne relie le départ au boss.");
  const routeResults = routes.map(validateRoute);
  for (const result of routeResults) errors.push(...result.errors);
  const signatures = new Set(routes.map((route) => route.map((node) => `${node.type}:${node.difficulty ?? "-"}`).join("|")));
  if (routes.length > 1 && signatures.size < 2) errors.push("Toutes les routes proposent exactement la même succession de cases.");
  const hiddenNodes = map.nodes.filter((node) => node.hidden === true);
  if (hiddenNodes.length > 1) errors.push("La carte contient plus d’une rencontre cachée.");
  if (hiddenNodes.some((node) => (node.rewardGold ?? 0) !== 0)) errors.push("La rencontre cachée ne doit donner aucune récompense directe.");
  return { valid:errors.length === 0, errors, routes:routeResults, routeCount:routes.length };
}
