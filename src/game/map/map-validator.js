"use strict";

const VIDEO_TYPES = new Set(["normal","elite","boss","hidden"]);
const NON_VIDEO_TYPES = new Set(["event","shop","campfire","special"]);
const DURATIONS = Object.freeze({normal:3.5,elite:5,boss:7,hidden:3.5});
const GOLD = Object.freeze({warmup:27.5,easy:32.5,normal:37.5,hard:50,eliteEasy:57.5,eliteNormal:65,eliteHard:80,event:15});

function getNodeMap(map){return new Map(map.nodes.map((node)=>[node.id,node]));}
export function getAllRoutes(map,{includeHidden=false}={}){
  const nodesById=getNodeMap(map);const start=nodesById.get(map.startNodeId);const routes=[];if(!start)return routes;
  function visit(node,route,visited){
    if(visited.has(node.id))return;const nextRoute=[...route,node];
    if(node.id===map.bossNodeId){routes.push(nextRoute);return;}
    const nextVisited=new Set(visited);nextVisited.add(node.id);
    for(const id of node.nextNodeIds??[]){const next=nodesById.get(id);if(!next||(!includeHidden&&next.hidden===true))continue;visit(next,nextRoute,nextVisited);}
  }
  visit(start,[],new Set());return routes;
}
function countType(route,type){return route.filter((node)=>node.type===type).length;}
function maxConsecutive(route,predicate){let maximum=0,current=0;for(const node of route){current=predicate(node)?current+1:0;maximum=Math.max(maximum,current);}return maximum;}
export function estimateNodeDurationMinutes(node={}){if(node.type==="event"&&node.hasVideo===true)return Number(node.estimatedDurationMinutes)||3.5;return DURATIONS[node.type]??0;}
export function estimateRouteDurationMinutes(route){return route.reduce((total,node)=>total+estimateNodeDurationMinutes(node),0);}
function estimateNodeGold(node){
  if(node.type==="normal")return GOLD[node.difficulty]??37.5;
  if(node.type==="elite"){const difficulty=String(node.difficulty??"normal");return GOLD[`elite${difficulty[0].toUpperCase()}${difficulty.slice(1)}`]??65;}
  if(node.type==="event")return Number(node.expectedGold??GOLD.event);return 0;
}
export function estimateRouteGold(route,startingGold=50){return route.reduce((total,node)=>total+estimateNodeGold(node),startingGold);}
function normalBeforeElite(route){const index=route.findIndex((node)=>node.type==="elite");return index>=0&&route.slice(0,index).some((node)=>node.type==="normal");}
function punishingTail(route){const tail=route.filter((node)=>node.type!=="start").slice(-3);return tail.length===3&&tail[0]?.type==="normal"&&tail[0]?.difficulty==="hard"&&tail[1]?.type==="elite"&&tail[1]?.difficulty==="hard"&&tail[2]?.type==="boss";}
function validateRoute(route,index,rowCount){
  const errors=[];const playable=route.filter((node)=>node.type!=="start");const first=playable[0]??null;const last=route.at(-1)??null;
  const normal=countType(route,"normal"),elite=countType(route,"elite"),event=countType(route,"event"),shop=countType(route,"shop"),campfire=countType(route,"campfire");
  const durationMinutes=estimateRouteDurationMinutes(route),expectedGold=estimateRouteGold(route),prefix=`Route ${index+1}`;
  const firstThird=Math.floor((rowCount-1)/3),lastThird=Math.ceil((rowCount-1)*2/3);
  if(first?.difficulty!=="warmup")errors.push(`${prefix} : le premier choix n’est pas un Warm-up.`);
  if(last?.type!=="boss")errors.push(`${prefix} : la route ne se termine pas par le boss.`);
  if(normal<4||normal>8)errors.push(`${prefix} : ${normal} rencontres normales au lieu de 4 à 8.`);
  if(elite<1||elite>3)errors.push(`${prefix} : ${elite} élites au lieu de 1 à 3.`);
  if(event>3)errors.push(`${prefix} : ${event} événements au lieu d’un maximum de 3.`);
  if(shop>2)errors.push(`${prefix} : ${shop} boutiques au lieu d’un maximum de 2.`);
  if(campfire>2)errors.push(`${prefix} : ${campfire} feux de camp au lieu d’un maximum de 2.`);
  if(!normalBeforeElite(route))errors.push(`${prefix} : aucune rencontre normale ne précède le premier élite.`);
  if(maxConsecutive(route,(node)=>node.type==="normal")>3)errors.push(`${prefix} : plus de trois rencontres normales consécutives.`);
  if(maxConsecutive(route,(node)=>node.type==="elite")>1)errors.push(`${prefix} : deux élites consécutifs.`);
  if(maxConsecutive(route,(node)=>node.type==="shop")>1)errors.push(`${prefix} : deux boutiques consécutives.`);
  if(maxConsecutive(route,(node)=>node.type==="campfire")>1)errors.push(`${prefix} : deux feux de camp consécutifs.`);
  if(maxConsecutive(route,(node)=>NON_VIDEO_TYPES.has(node.type)&&!(node.type==="event"&&node.hasVideo))>2)errors.push(`${prefix} : plus de deux cases sans vidéo consécutives.`);
  if(maxConsecutive(route,(node)=>VIDEO_TYPES.has(node.type)||(node.type==="event"&&node.hasVideo))>3)errors.push(`${prefix} : plus de trois cases vidéo consécutives.`);
  if(route.some((node)=>node.type==="elite"&&node.row<=2))errors.push(`${prefix} : un élite apparaît dans les deux premières rangées.`);
  if(route.some((node)=>(node.type==="normal"||node.type==="elite")&&node.difficulty==="hard"&&node.row<=firstThird))errors.push(`${prefix} : une rencontre difficile apparaît dans le premier tiers.`);
  if(route.some((node)=>node.type==="normal"&&node.difficulty==="easy"&&node.row>=lastThird))errors.push(`${prefix} : une rencontre facile apparaît trop près du boss.`);
  if(maxConsecutive(route,(node)=>node.type==="normal"&&node.difficulty==="hard")>2)errors.push(`${prefix} : plus de deux rencontres difficiles consécutives.`);
  if(punishingTail(route))errors.push(`${prefix} : séquence difficile, élite difficile, boss imposée avant la fin.`);
  if(durationMinutes<29.5||durationMinutes>45)errors.push(`${prefix} : durée estimée de ${durationMinutes.toFixed(1)} minutes au lieu d’environ 30 à 45.`);
  if(expectedGold<300||expectedGold>460)errors.push(`${prefix} : économie estimée à ${expectedGold.toFixed(0)} pièces au lieu de 300 à 460.`);
  return{valid:errors.length===0,errors,counts:{normal,elite,event,shop,campfire},durationMinutes,expectedGold,nodeIds:route.map((node)=>node.id)};
}
function branchCount(map){return map.nodes.filter((node)=>node.hidden!==true&&new Set(node.nextNodeIds??[]).size>=2).length;}
function validateCoverage(map,errors){
  const nodes=getNodeMap(map),incoming=new Map(map.nodes.map((node)=>[node.id,0]));
  for(const node of map.nodes)for(const id of node.nextNodeIds??[]){if(!nodes.has(id))errors.push(`La connexion ${node.id} → ${id} pointe vers une case inexistante.`);else incoming.set(id,(incoming.get(id)??0)+1);}
  for(const node of map.nodes){if(node.hidden===true||node.id===map.startNodeId)continue;if((incoming.get(node.id)??0)===0)errors.push(`La case ${node.id} est inaccessible.`);if(node.id!==map.bossNodeId&&!(node.nextNodeIds?.length))errors.push(`La case ${node.id} est un chemin mort.`);}
}
export function validateMap(map){
  const errors=[];if(!map||!Array.isArray(map.nodes)||!Array.isArray(map.rows))return{valid:false,errors:["La structure de carte est invalide."],routes:[]};
  if(map.rows.length<10||map.rows.length>14)errors.push(`La carte contient ${map.rows.length} rangées au lieu de 10 à 14.`);
  if(map.rows[0]?.length!==1||map.rows[0]?.[0]?.type!=="start")errors.push("La première rangée doit uniquement contenir le départ.");
  if(map.rows.at(-1)?.length!==1||map.rows.at(-1)?.[0]?.type!=="boss")errors.push("La dernière rangée doit uniquement contenir le boss.");
  if(map.rows.slice(1,-1).some((row)=>row.length<3))errors.push("Les rangées intermédiaires doivent conserver les trois chemins principaux.");
  validateCoverage(map,errors);const routes=getAllRoutes(map);if(!routes.length)errors.push("Aucune route ne relie le départ au boss.");
  const results=routes.map((route,index)=>validateRoute(route,index,map.rows.length));for(const result of results)errors.push(...result.errors);
  const meaningfulBranches=branchCount(map);if(meaningfulBranches<2)errors.push(`La carte ne contient que ${meaningfulBranches} embranchement(s) réel(s), au lieu d’au moins 2.`);
  const signatures=new Set(routes.map((route)=>route.map((node)=>`${node.type}:${node.difficulty??"-"}`).join("|")));if(routes.length>1&&signatures.size<3)errors.push("Les trois chemins principaux ne proposent pas assez de parcours différents.");
  const goldValues=results.map((route)=>route.expectedGold).filter(Number.isFinite);if(goldValues.length>1){const min=Math.min(...goldValues),max=Math.max(...goldValues);if(min>0&&max/min>1.25)errors.push(`L’écart économique entre les routes dépasse 25 % (${min.toFixed(0)} à ${max.toFixed(0)} pièces).`);}
  const eventIds=map.nodes.filter((node)=>node.type==="event").map((node)=>node.eventId);if(eventIds.some((id)=>!id))errors.push("Une case événement ne possède aucun événement réel.");if(new Set(eventIds).size!==eventIds.length)errors.push("Un même événement est utilisé plusieurs fois sur la carte.");
  const hidden=map.nodes.filter((node)=>node.hidden===true);if(hidden.length>1)errors.push("La carte contient plus d’une rencontre cachée.");if(hidden.some((node)=>(node.rewardGold??0)!==0))errors.push("La rencontre cachée ne doit donner aucune récompense directe.");if(hidden.some((node)=>node.mediaType!=="secret"))errors.push("La rencontre cachée doit sélectionner exclusivement le catalogue média secret.");if(hidden.some((node)=>node.encounterId))errors.push("La rencontre cachée ne doit pas réutiliser une rencontre normale ou élite codée en dur.");
  return{valid:errors.length===0,errors,routes:results,routeCount:routes.length,meaningfulBranches,rowCount:map.rows.length};
}
