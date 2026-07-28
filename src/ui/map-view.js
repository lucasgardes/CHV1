"use strict";

import { registerMapView } from "../game/runtime-access.js";

const MAP_WIDTH = 720;
const LANE_X = [140, 360, 580];
const ROW_GAP = 130;
const MAP_PADDING = 70;
const SYMBOLS = Object.freeze({ start:"D", normal:"N", event:"?", elite:"E", shop:"$", campfire:"F", hidden:"?", boss:"B" });
const TYPE_LABELS = Object.freeze({ start:"Départ", normal:"Rencontre", event:"Événement mystère", elite:"Élite", shop:"Boutique", campfire:"Feu de camp", hidden:"Salle inconnue", boss:"Boss" });
const DIFFICULTY_LABELS = Object.freeze({ warmup:"Warm-up", easy:"Facile", normal:"Normale", hard:"Difficile", boss:"Boss" });

function ensureMapStylesheet(){if(document.querySelector('link[data-map-styles="true"]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="./map.css";link.dataset.mapStyles="true";document.head.append(link);}
function formatDuration(seconds){const value=Math.max(0,Number(seconds)||0);if(!value)return"Durée inconnue";const minutes=Math.floor(value/60);const remaining=Math.round(value%60);return`${String(minutes).padStart(2,"0")}:${String(remaining).padStart(2,"0")}`;}
function wait(milliseconds){return new Promise((resolve)=>window.setTimeout(resolve,milliseconds));}

export class MapView{
 constructor({mapNodeList,goldValue,inventoryValue,getItemById,onNodeSelected}){
  if(!(mapNodeList instanceof HTMLDivElement))throw new Error("La liste des cases de la carte est invalide.");
  if(!(goldValue instanceof HTMLElement))throw new Error("L’affichage de l’or est invalide.");
  if(!(inventoryValue instanceof HTMLElement))throw new Error("L’affichage de l’inventaire est invalide.");
  if(typeof getItemById!=="function")throw new Error("getItemById doit être une fonction.");
  if(typeof onNodeSelected!=="function")throw new Error("onNodeSelected doit être une fonction.");
  ensureMapStylesheet();Object.assign(this,{mapNodeList,goldValue,inventoryValue,getItemById,onNodeSelected});this.navigationLocked=false;this.selectedNodeId=null;this.lastRender=null;registerMapView(this);
 }
 render({gameState,currentNode,accessibleNodes}){
  this.navigationLocked=false;this.selectedNodeId=null;this.lastRender={gameState,currentNode,accessibleNodes};this.mapNodeList.replaceChildren();this.renderGold(gameState.gold);this.renderInventory(gameState.inventory);
  const rows=accessibleNodes.mapRows;const nodes=accessibleNodes.mapNodes;
  if(currentNode===null){this.renderError("La case actuelle est introuvable.");return;}
  if(!Array.isArray(rows)||!Array.isArray(nodes)){this.renderError("Les données complètes de la carte sont indisponibles.");return;}
  const wrapper=document.createElement("div");wrapper.className="map-scroll-area";
  const graph=document.createElement("div");graph.className="map-graph";graph.style.width=`${MAP_WIDTH}px`;graph.style.height=`${this.getHeight(rows.length)}px`;
  const positions=this.createPositions(rows);graph.append(this.createConnections({nodes,positions,currentNodeId:gameState.currentNodeId,completedNodeIds:gameState.completedNodeIds,accessibleNodes}));
  for(const node of nodes){const position=positions.get(node.id);if(position)graph.append(this.createNode({node,position,currentNode,accessibleNodes,completedNodeIds:gameState.completedNodeIds,gameState}));}
  const marker=document.createElement("div");marker.className="map-player-marker";marker.setAttribute("aria-hidden","true");const currentPosition=positions.get(currentNode.id);if(currentPosition){marker.style.left=`${currentPosition.x}px`;marker.style.top=`${currentPosition.y}px`;}graph.append(marker);
  wrapper.append(graph);this.mapNodeList.append(wrapper);this.renderDefaultPreview(currentNode);window.requestAnimationFrame(()=>this.scrollToCurrent(wrapper,currentNode.id));
 }
 getHeight(rowCount){return MAP_PADDING*2+Math.max(0,rowCount-1)*ROW_GAP;}
 createPositions(rows){const positions=new Map();const lastRow=rows.length-1;for(const row of rows)for(const node of row)positions.set(node.id,{x:LANE_X[node.lane],y:MAP_PADDING+(lastRow-node.row)*ROW_GAP});return positions;}
 createConnections({nodes,positions,currentNodeId,completedNodeIds,accessibleNodes}){
  const namespace="http://www.w3.org/2000/svg";const svg=document.createElementNS(namespace,"svg");const accessibleIds=new Set(accessibleNodes.map((node)=>node.id));const completedIds=new Set(completedNodeIds);const rowCount=Math.max(...nodes.map((node)=>node.row))+1;
  svg.classList.add("map-connections");svg.setAttribute("viewBox",`0 0 ${MAP_WIDTH} ${this.getHeight(rowCount)}`);svg.setAttribute("aria-hidden","true");
  for(const node of nodes){const source=positions.get(node.id);if(!source)continue;for(const targetId of node.nextNodeIds){const target=positions.get(targetId);if(!target)continue;const line=document.createElementNS(namespace,"line");line.setAttribute("x1",String(source.x));line.setAttribute("y1",String(source.y));line.setAttribute("x2",String(target.x));line.setAttribute("y2",String(target.y));line.dataset.sourceId=node.id;line.dataset.targetId=targetId;line.classList.add("map-connection");if(completedIds.has(node.id))line.classList.add("is-completed");if(node.id===currentNodeId&&accessibleIds.has(targetId))line.classList.add("is-accessible");svg.append(line);}}
  return svg;
 }
 createNode({node,position,currentNode,accessibleNodes,completedNodeIds,gameState}){
  const accessible=accessibleNodes.some((entry)=>entry.id===node.id);const current=node.id===currentNode.id;const completed=completedNodeIds.includes(node.id);const locked=!accessible&&!current&&!completed;const reveal=gameState.getMapEncounterReveal?.(node.id)??null;const button=document.createElement("button");
  button.type="button";button.className=["map-node-button",`map-node-${node.type}`,current?"is-current":"",accessible?"is-accessible":"",completed?"is-completed":"",locked?"is-locked":"",reveal?"is-revealed":""].filter(Boolean).join(" ");button.dataset.nodeId=node.id;button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;button.disabled=!accessible;
  const shownTitle=node.type==="hidden"&&!reveal?"Salle inconnue":node.title;const difficultyLabel=reveal?.difficulty?(DIFFICULTY_LABELS[reveal.difficulty]??reveal.difficulty):(node.type==="boss"?"Boss":null);const revealText=reveal?`, durée ${formatDuration(reveal.durationSeconds)}`:"";button.setAttribute("aria-label",`${shownTitle}${difficultyLabel?`, difficulté ${difficultyLabel}`:""}${revealText}${current?", position actuelle":""}`);
  const symbol=document.createElement("span");symbol.className="map-node-symbol";symbol.textContent=SYMBOLS[node.type]??"•";const label=document.createElement("span");label.className="map-node-label";label.textContent=shownTitle;button.append(symbol,label);
  if(reveal){const details=document.createElement("span");details.className="map-node-difficulty map-node-reveal";details.textContent=`${difficultyLabel??"?"} · ${formatDuration(reveal.durationSeconds)}`;button.append(details);}else if(locked){const hidden=document.createElement("span");hidden.className="map-node-difficulty";hidden.textContent="Verrouillée";button.append(hidden);}
  button.addEventListener("mouseenter",()=>this.previewNode(node,{accessible,current,completed,locked,reveal,temporary:true}));button.addEventListener("focus",()=>this.previewNode(node,{accessible,current,completed,locked,reveal,temporary:true}));
  if(accessible)button.addEventListener("click",()=>this.selectNode(node,{accessible,current,completed,locked,reveal}));
  return button;
 }
 selectNode(node,state){if(this.navigationLocked)return;this.selectedNodeId=node.id;for(const candidate of this.mapNodeList.querySelectorAll(".map-node-button"))candidate.classList.toggle("is-selected",candidate.dataset.nodeId===node.id);this.previewNode(node,{...state,temporary:false});}
 previewNode(node,{accessible,current,completed,locked,reveal,temporary=false}){
  if(temporary&&this.selectedNodeId)return;
  const sidebar=document.querySelector("#map-screen .detail-sidebar");if(!(sidebar instanceof HTMLElement))return;
  const symbol=sidebar.querySelector(".detail-symbol");const title=sidebar.querySelector("h2");const copy=sidebar.querySelector(".detail-copy");if(symbol)symbol.textContent=SYMBOLS[node.type]??"•";if(title)title.textContent=node.type==="hidden"&&!reveal?"Salle inconnue":node.title;
  if(copy){copy.replaceChildren();const type=document.createElement("strong");type.textContent=TYPE_LABELS[node.type]??"Salle";copy.append(type);const details=document.createElement("span");details.className="map-preview-details";const lines=[`Rangée ${Number(node.row)+1}`];if(reveal?.difficulty)lines.push(`Difficulté : ${DIFFICULTY_LABELS[reveal.difficulty]??reveal.difficulty}`);if(reveal?.durationSeconds)lines.push(`Durée : ${formatDuration(reveal.durationSeconds)}`);if(!reveal&&["normal","elite"].includes(node.type))lines.push("Difficulté et durée inconnues");if(locked)lines.push("Cette route n’est pas accessible depuis ta position actuelle.");else if(completed)lines.push("Salle déjà parcourue.");else if(current)lines.push("Position actuelle.");details.textContent=lines.join("\n");copy.append(details);}
  this.renderPreviewAction(sidebar,node,accessible);
 }
 renderDefaultPreview(currentNode){const sidebar=document.querySelector("#map-screen .detail-sidebar");if(!(sidebar instanceof HTMLElement))return;this.removePreviewAction(sidebar);const title=sidebar.querySelector("h2");const copy=sidebar.querySelector(".detail-copy");const symbol=sidebar.querySelector(".detail-symbol");if(symbol)symbol.textContent=SYMBOLS[currentNode.type]??"•";if(title)title.textContent="Choisis une destination";if(copy)copy.textContent="Survole une salle pour l’examiner, puis sélectionne une destination accessible.";}
 renderPreviewAction(sidebar,node,accessible){this.removePreviewAction(sidebar);if(!accessible)return;const button=document.createElement("button");button.type="button";button.className="primary-button map-confirm-button";button.textContent="Entrer dans cette salle";button.dataset.nodeId=node.id;button.addEventListener("click",()=>void this.confirmSelection(node.id));const divider=sidebar.querySelector(".detail-divider");sidebar.insertBefore(button,divider);}
 removePreviewAction(sidebar){sidebar.querySelector(".map-confirm-button")?.remove();}
 async confirmSelection(nodeId){if(this.navigationLocked||this.selectedNodeId!==nodeId)return;this.navigationLocked=true;for(const candidate of this.mapNodeList.querySelectorAll(".map-node-button.is-accessible"))candidate.disabled=true;const confirm=document.querySelector(".map-confirm-button");if(confirm instanceof HTMLButtonElement)confirm.disabled=true;try{await this.animateTravel(nodeId);await this.onNodeSelected(nodeId);}catch(error){this.navigationLocked=false;for(const candidate of this.mapNodeList.querySelectorAll(".map-node-button.is-accessible"))candidate.disabled=false;if(confirm instanceof HTMLButtonElement)confirm.disabled=false;throw error;}}
 async animateTravel(targetNodeId){const graph=this.mapNodeList.querySelector(".map-graph");const marker=graph?.querySelector(".map-player-marker");const target=graph?.querySelector(`[data-node-id="${CSS.escape(targetNodeId)}"]`);const line=graph?.querySelector(`.map-connection.is-accessible[data-target-id="${CSS.escape(targetNodeId)}"]`);if(!(marker instanceof HTMLElement)||!(target instanceof HTMLElement))return;if(line instanceof SVGElement)line.classList.add("is-travelling");target.classList.add("is-travel-target");marker.classList.add("is-moving");marker.style.left=target.style.left;marker.style.top=target.style.top;await wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches?80:650);}
 scrollToCurrent(wrapper,nodeId){const button=wrapper.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);if(!(button instanceof HTMLElement))return;wrapper.scrollTo({top:Math.max(0,button.offsetTop-wrapper.clientHeight/2+button.offsetHeight/2),behavior:"smooth"});}
 renderGold(gold){this.goldValue.textContent=String(gold);}
 renderInventory(inventory){if(!Array.isArray(inventory)||inventory.length===0){this.inventoryValue.textContent="Aucun";return;}this.inventoryValue.textContent=inventory.map((itemId)=>this.getItemById(itemId)?.name??itemId).join(", ");}
 renderError(message){const error=document.createElement("p");error.className="map-error-message";error.textContent=message;this.mapNodeList.append(error);}
}