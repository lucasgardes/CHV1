"use strict";

import { registerMapView } from "../game/runtime-access.js";

const MAP_WIDTH = 720;
const LANE_X = [140, 360, 580];
const ROW_GAP = 130;
const MAP_PADDING = 70;
const SYMBOLS = Object.freeze({ start:"D", normal:"N", event:"?", elite:"E", shop:"$", campfire:"F", hidden:"H", boss:"B" });
const DIFFICULTY_LABELS = Object.freeze({ warmup:"Warm-up", easy:"Facile", normal:"Normale", hard:"Difficile", boss:"Boss" });

function ensureMapStylesheet(){if(document.querySelector('link[data-map-styles="true"]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="./map.css";link.dataset.mapStyles="true";document.head.append(link);}

export class MapView{
 constructor({mapNodeList,goldValue,inventoryValue,getItemById,onNodeSelected}){
  if(!(mapNodeList instanceof HTMLDivElement))throw new Error("La liste des cases de la carte est invalide.");
  if(!(goldValue instanceof HTMLElement))throw new Error("L’affichage de l’or est invalide.");
  if(!(inventoryValue instanceof HTMLElement))throw new Error("L’affichage de l’inventaire est invalide.");
  if(typeof getItemById!=="function")throw new Error("getItemById doit être une fonction.");
  if(typeof onNodeSelected!=="function")throw new Error("onNodeSelected doit être une fonction.");
  ensureMapStylesheet();Object.assign(this,{mapNodeList,goldValue,inventoryValue,getItemById,onNodeSelected});this.navigationLocked=false;registerMapView(this);
 }
 render({gameState,currentNode,accessibleNodes}){
  this.navigationLocked=false;this.mapNodeList.replaceChildren();this.renderGold(gameState.gold);this.renderInventory(gameState.inventory);
  const rows=accessibleNodes.mapRows;const nodes=accessibleNodes.mapNodes;
  if(currentNode===null){this.renderError("La case actuelle est introuvable.");return;}
  if(!Array.isArray(rows)||!Array.isArray(nodes)){this.renderError("Les données complètes de la carte sont indisponibles.");return;}
  const wrapper=document.createElement("div");wrapper.className="map-scroll-area";
  const graph=document.createElement("div");graph.className="map-graph";graph.style.width=`${MAP_WIDTH}px`;graph.style.height=`${this.getHeight(rows.length)}px`;
  const positions=this.createPositions(rows);graph.append(this.createConnections({nodes,positions,currentNodeId:gameState.currentNodeId,completedNodeIds:gameState.completedNodeIds,accessibleNodes}));
  for(const node of nodes){const position=positions.get(node.id);if(position)graph.append(this.createNode({node,position,currentNode,accessibleNodes,completedNodeIds:gameState.completedNodeIds}));}
  wrapper.append(graph);this.mapNodeList.append(wrapper);window.requestAnimationFrame(()=>this.scrollToCurrent(wrapper,currentNode.id));
 }
 getHeight(rowCount){return MAP_PADDING*2+Math.max(0,rowCount-1)*ROW_GAP;}
 createPositions(rows){const positions=new Map();const lastRow=rows.length-1;for(const row of rows)for(const node of row)positions.set(node.id,{x:LANE_X[node.lane],y:MAP_PADDING+(lastRow-node.row)*ROW_GAP});return positions;}
 createConnections({nodes,positions,currentNodeId,completedNodeIds,accessibleNodes}){
  const namespace="http://www.w3.org/2000/svg";const svg=document.createElementNS(namespace,"svg");const accessibleIds=new Set(accessibleNodes.map((node)=>node.id));const completedIds=new Set(completedNodeIds);const rowCount=Math.max(...nodes.map((node)=>node.row))+1;
  svg.classList.add("map-connections");svg.setAttribute("viewBox",`0 0 ${MAP_WIDTH} ${this.getHeight(rowCount)}`);svg.setAttribute("aria-hidden","true");
  for(const node of nodes){const source=positions.get(node.id);if(!source)continue;for(const targetId of node.nextNodeIds){const target=positions.get(targetId);if(!target)continue;const line=document.createElementNS(namespace,"line");line.setAttribute("x1",String(source.x));line.setAttribute("y1",String(source.y));line.setAttribute("x2",String(target.x));line.setAttribute("y2",String(target.y));line.classList.add("map-connection");if(completedIds.has(node.id))line.classList.add("is-completed");if(node.id===currentNodeId&&accessibleIds.has(targetId))line.classList.add("is-accessible");svg.append(line);}}
  return svg;
 }
 createNode({node,position,currentNode,accessibleNodes,completedNodeIds}){
  const accessible=accessibleNodes.some((entry)=>entry.id===node.id);const current=node.id===currentNode.id;const completed=completedNodeIds.includes(node.id);const button=document.createElement("button");
  button.type="button";button.className=["map-node-button",`map-node-${node.type}`,node.difficulty?`map-difficulty-${node.difficulty}`:"",current?"is-current":"",accessible?"is-accessible":"",completed?"is-completed":""].filter(Boolean).join(" ");button.dataset.nodeId=node.id;button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;button.disabled=!accessible;
  const difficultyLabel=node.difficulty?(DIFFICULTY_LABELS[node.difficulty]??node.difficulty):null;const accessibleLabel=current?", position actuelle":"";const difficultyText=difficultyLabel?`, difficulté ${difficultyLabel}`:"";button.setAttribute("aria-label",`${node.title}${difficultyText}${accessibleLabel}`);
  const symbol=document.createElement("span");symbol.className="map-node-symbol";symbol.textContent=SYMBOLS[node.type]??"•";const label=document.createElement("span");label.className="map-node-label";label.textContent=node.title;button.append(symbol,label);
  if(difficultyLabel&&node.type!=="boss"){const difficulty=document.createElement("span");difficulty.className="map-node-difficulty";difficulty.textContent=difficultyLabel;button.append(difficulty);}
  if(accessible)button.addEventListener("click",()=>{if(this.navigationLocked)return;this.navigationLocked=true;for(const candidate of this.mapNodeList.querySelectorAll(".map-node-button.is-accessible"))candidate.disabled=true;const navigation=this.onNodeSelected(node.id);Promise.resolve(navigation).catch(()=>{this.navigationLocked=false;for(const candidate of this.mapNodeList.querySelectorAll(".map-node-button.is-accessible"))candidate.disabled=false;});});
  return button;
 }
 scrollToCurrent(wrapper,nodeId){const button=wrapper.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);if(!(button instanceof HTMLElement))return;wrapper.scrollTo({top:Math.max(0,button.offsetTop-wrapper.clientHeight/2+button.offsetHeight/2),behavior:"smooth"});}
 renderGold(gold){this.goldValue.textContent=String(gold);}
 renderInventory(inventory){if(!Array.isArray(inventory)||inventory.length===0){this.inventoryValue.textContent="Aucun";return;}this.inventoryValue.textContent=inventory.map((itemId)=>this.getItemById(itemId)?.name??itemId).join(", ");}
 renderError(message){const error=document.createElement("p");error.className="map-error-message";error.textContent=message;this.mapNodeList.append(error);}
}
