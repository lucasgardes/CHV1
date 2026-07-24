"use strict";

import { getAvailableItems,getItemById,getRandomAvailableItem } from "../data/items.js";
function randomBetween(minimum,maximum,random){const min=Math.ceil(Number(minimum)||0);const max=Math.floor(Number(maximum)||min);return Math.floor(min+random()*(max-min+1));}
export class EventResolver{
 constructor({gameState,itemController=null,mapController=null,startEncounter=async()=>{},random=Math.random}){Object.assign(this,{gameState,itemController,mapController,startEncounter,random});}
 rewardCuriosity(){if(this.gameState.activeBlessingId!=="rewarded-curiosity"||this.gameState.getRunFlag?.("rewarded-curiosity-used"))return 0;this.gameState.setRunFlag?.("rewarded-curiosity-used",true);return this.gameState.addGold(30);}
 async resolve(effect={}){const amount=effect.amountRange?randomBetween(effect.amountRange[0],effect.amountRange[1],this.random):effect.amount;switch(effect.type){
  case"none":return{type:effect.type};
  case"gain-gold":{const applied=this.gameState.addGold(amount);const blessingGold=this.rewardCuriosity();return{type:effect.type,amount:applied,blessingGold};}
  case"lose-gold":return{type:effect.type,amount:this.gameState.loseGold(amount)};
  case"gain-item":{const result=this.gainItem(effect.itemId);if(result.itemId)result.blessingGold=this.rewardCuriosity();return result;}
  case"random-item":{const result=this.gainItem(this.pickAvailableItem(effect.itemType)?.id??null);if(result.itemId)result.blessingGold=this.rewardCuriosity();return result;}
  case"three-lockers-security":return this.resolveThreeLockersSecurity(effect);
  case"reveal-next-encounters":return this.revealNextEncounters(effect.count??2);
  case"choose-random-items":return{type:effect.type,candidates:this.pickAvailableItems(effect.count??2,effect.itemType)};
  case"exchange-item":return this.exchangeItem(effect.giveItemId,effect.receiveItemId);
  case"lose-random-item":return this.loseRandomItem(effect.itemType);
  case"lose-item":return this.loseItem(effect.itemId);
  case"difficulty-shift":this.gameState.queueNextFunscriptDifficultyShift(effect.amount);return{type:effect.type,amount:effect.amount};
  case"arm-protection":this.gameState.armNextEncounterProtection();return{type:effect.type,blessingGold:this.rewardCuriosity()};
  case"encounter-modifier":return{type:effect.type,modifier:this.gameState.addEncounterModifier(effect)};
  case"next-duration":return{type:effect.type,modifier:this.gameState.addEncounterModifier({source:effect.source??"event",durationSeconds:effect.seconds,encountersRemaining:effect.encounters??1}),blessingGold:Number(effect.seconds)<0?this.rewardCuriosity():0};
  case"next-reward":return{type:effect.type,modifier:this.gameState.addEncounterModifier({source:effect.source??"event",rewardGoldFlat:effect.goldFlat??0,rewardMultiplier:effect.multiplier??1,encountersRemaining:effect.encounters??1}),blessingGold:this.rewardCuriosity()};
  case"next-intensity":return{type:effect.type,modifier:this.gameState.addEncounterModifier({source:effect.source??"event",intensityShift:effect.amount,encountersRemaining:effect.encounters??1})};
  case"hide-interface":return{type:effect.type,modifier:this.gameState.addEncounterModifier({source:effect.source??"event",hideInterfaceSeconds:effect.seconds,encountersRemaining:1})};
  case"shop-price-multiplier":this.gameState.multiplyNextShopPrices(effect.multiplier);return{type:effect.type,multiplier:effect.multiplier,blessingGold:Number(effect.multiplier)<1?this.rewardCuriosity():0};
  case"elite-rare-bonus":this.gameState.addNextEliteRareChanceBonus(effect.amount);return{type:effect.type,amount:effect.amount,blessingGold:this.rewardCuriosity()};
  case"queue-deferred-reward":return{type:effect.type,reward:this.gameState.queueDeferredEncounterReward({id:effect.id,source:effect.source,gold:effect.gold,encounters:effect.encounters})};
  case"disable-random-item-with-deferred-reward":return this.disableRandomItemWithDeferredReward(effect);
  case"disable-item":return this.disableItem(effect.itemId,effect.encounters??2);
  case"disable-random-item":return this.disableRandomItem(effect.itemType,effect.encounters??2);
  case"recharge-item":{const result=this.rechargeItem(effect.itemId);if(result.itemId)result.blessingGold=this.rewardCuriosity();return result;}
  case"recharge-random-item":{const result=this.rechargeRandomItem(effect.itemType);if(result.itemId)result.blessingGold=this.rewardCuriosity();return result;}
  case"reduce-recharge-all":{const result=this.reduceRechargeAll(effect.rounds??1);if(result.itemIds.length)result.blessingGold=this.rewardCuriosity();return result;}
  case"relation":return{type:effect.type,cobayeId:effect.cobayeId,value:this.gameState.adjustCobayeRelation(effect.cobayeId,effect.amount)};
  case"set-flag":this.gameState.setEventFlag(effect.flag,effect.value??true);return{type:effect.type,flag:effect.flag,value:effect.value??true};
  case"compound":return this.resolveCompound(effect.effects??[]);
  case"random-outcome":return this.resolveRandomOutcome(effect.outcomes??[]);
  case"start-encounter":await this.startEncounter(effect.encounterId,effect.encounterType||"normal");return{type:effect.type,encounterId:effect.encounterId};
  default:throw new Error(`Effet d’événement inconnu : ${effect.type}`);
 }}
 async resolveCompound(effects){const results=[];for(const effect of effects)results.push(await this.resolve(effect));return{type:"compound",results};}
 async resolveRandomOutcome(outcomes){if(!outcomes.length)return{type:"random-outcome",result:null};const selected=outcomes[Math.floor(this.random()*outcomes.length)];return{type:"random-outcome",result:await this.resolve(selected)};}
 pickAvailableItem(itemType=null){if(!itemType)return getRandomAvailableItem(this.gameState.inventory);const available=getAvailableItems(this.gameState.inventory).filter((item)=>item.type===itemType);return available[Math.floor(this.random()*available.length)]??null;}
 pickAvailableItems(count,itemType=null){const pool=getAvailableItems(this.gameState.inventory).filter((item)=>!itemType||item.type===itemType);const selected=[];while(pool.length&&selected.length<count)selected.push(pool.splice(Math.floor(this.random()*pool.length),1)[0]);return selected.map((item)=>item.id);}
 gainItem(itemId){const item=getItemById(itemId);if(!item||!this.gameState.addItem(itemId))return{type:"gain-item",itemId:null};this.itemController?.ensureRuntimeState(itemId);return{type:"gain-item",itemId};}
 loseItem(itemId){if(!itemId||!this.gameState.removeItem(itemId))return{type:"lose-item",itemId:null};this.itemController?.runtimeStates?.delete(itemId);return{type:"lose-item",itemId};}
 resolveThreeLockersSecurity(effect={}){const ownsRechargeable=this.gameState.inventory.some((itemId)=>getItemById(itemId)?.type==="rechargeable");if(!ownsRechargeable){const fallback=this.gainItem(this.pickAvailableItem("consumable")?.id??null);return{type:"three-lockers-security",mode:"fallback-consumable",itemId:fallback.itemId,blessingGold:fallback.itemId?this.rewardCuriosity():0};}const reduction=this.reduceRechargeAll(effect.rounds??1);return{type:"three-lockers-security",mode:"recharge-reduction",itemIds:reduction.itemIds,rounds:reduction.rounds,blessingGold:this.rewardCuriosity()};}
 revealNextEncounters(count=2){const nodes=this.mapController?.getMap?.()?.nodes??[];const byId=new Map(nodes.map((node)=>[node.id,node]));const start=byId.get(this.gameState.currentNodeId);if(!start)return{type:"reveal-next-encounters",encounters:[]};const queue=(start.nextNodeIds??[]).map((id)=>({id,distance:1}));const visited=new Set([start.id]);const candidates=[];while(queue.length){const current=queue.shift();if(visited.has(current.id))continue;visited.add(current.id);const node=byId.get(current.id);if(!node)continue;if(["normal","elite","boss"].includes(node.type))candidates.push({...node,distance:current.distance});for(const nextId of node.nextNodeIds??[])queue.push({id:nextId,distance:current.distance+1});}candidates.sort((a,b)=>a.distance-b.distance||(a.row??0)-(b.row??0)||(a.lane??0)-(b.lane??0));const selected=candidates.slice(0,Math.max(0,Number(count)||0));const encounters=this.gameState.revealMapEncounters(selected);return{type:"reveal-next-encounters",encounters,observation:"Les écrans hésitent une seconde avant d’afficher des données qui ne t’étaient pas destinées."};}
 exchangeItem(giveItemId,receiveItemId){if(!giveItemId||!receiveItemId||giveItemId===receiveItemId)return{type:"exchange-item",givenItemId:null,receivedItemId:null};if(!this.gameState.hasItem(giveItemId)||this.gameState.hasItem(receiveItemId)||!getItemById(receiveItemId))return{type:"exchange-item",givenItemId:null,receivedItemId:null};if(!this.gameState.removeItem(giveItemId))return{type:"exchange-item",givenItemId:null,receivedItemId:null};if(!this.gameState.addItem(receiveItemId)){this.gameState.addItem(giveItemId);this.itemController?.ensureRuntimeState(giveItemId);return{type:"exchange-item",givenItemId:null,receivedItemId:null};}this.itemController?.runtimeStates?.delete(giveItemId);this.itemController?.ensureRuntimeState(receiveItemId);return{type:"exchange-item",givenItemId:giveItemId,receivedItemId:receiveItemId,blessingGold:this.rewardCuriosity()};}
 loseRandomItem(itemType=null){const candidates=this.gameState.inventory.filter((itemId)=>!itemType||getItemById(itemId)?.type===itemType);if(!candidates.length)return{type:"lose-item",itemId:null};return this.loseItem(candidates[Math.floor(this.random()*candidates.length)]);}
 disableItem(itemId,encounters){const disabled=this.gameState.disableItem(itemId,encounters);return{type:"disable-item",itemId:disabled?itemId:null,encounters};}
 disableRandomItem(itemType,encounters){const candidates=this.gameState.inventory.filter((itemId)=>!itemType||getItemById(itemId)?.type===itemType);if(!candidates.length)return{type:"disable-item",itemId:null,encounters};return this.disableItem(candidates[Math.floor(this.random()*candidates.length)],encounters);}
 disableRandomItemWithDeferredReward(effect){const disabled=this.disableRandomItem(effect.itemType,effect.disableEncounters??2);if(!disabled.itemId)return{type:effect.type,itemId:null,reward:null};const reward=this.gameState.queueDeferredEncounterReward({id:effect.rewardId,source:effect.source,gold:effect.gold,encounters:effect.rewardAfterEncounters??2});return{type:effect.type,itemId:disabled.itemId,disableEncounters:disabled.encounters,reward};}
 rechargeItem(itemId){if(!itemId||!this.gameState.hasItem(itemId)||getItemById(itemId)?.type!=="rechargeable")return{type:"recharge-item",itemId:null};this.itemController?.recharge(itemId);return{type:"recharge-item",itemId};}
 rechargeRandomItem(itemType="rechargeable"){const candidates=this.gameState.inventory.filter((itemId)=>getItemById(itemId)?.type===itemType);if(!candidates.length)return{type:"recharge-item",itemId:null};return this.rechargeItem(candidates[Math.floor(this.random()*candidates.length)]);}
 reduceRechargeAll(rounds){const affected=[];if(!this.itemController)return{type:"reduce-recharge-all",itemIds:affected,rounds};for(const itemId of this.gameState.inventory){if(getItemById(itemId)?.type!=="rechargeable")continue;const state=this.itemController.ensureRuntimeState(itemId);if(state.available||state.remainingRechargeRounds<=0)continue;state.remainingRechargeRounds=Math.max(0,state.remainingRechargeRounds-rounds);if(state.remainingRechargeRounds===0)this.itemController.recharge(itemId);affected.push(itemId);}return{type:"reduce-recharge-all",itemIds:affected,rounds};}
}