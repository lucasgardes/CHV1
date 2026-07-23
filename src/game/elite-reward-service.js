"use strict";

import { getAvailableItems, getItemValues, ITEM_RARITIES } from "../data/items.js";

const GOLD_RANGES=Object.freeze({easy:[50,65],normal:[55,75],hard:[70,90]});
function randomInt([minimum,maximum],random){return minimum+Math.floor(random()*(maximum-minimum+1));}
function inferDifficulty(encounter={}){const value=Number(encounter.difficulty)||2;return value<=1?"easy":value>=3?"hard":"normal";}
function weightedItem(items,rareChance,random){const rare=items.filter((item)=>item.rarity===ITEM_RARITIES.RARE);const standard=items.filter((item)=>item.rarity!==ITEM_RARITIES.RARE&&item.rarity!==ITEM_RARITIES.CURSED);const cursed=items.filter((item)=>item.rarity===ITEM_RARITIES.CURSED);if(rare.length&&random()<rareChance)return rare[Math.floor(random()*rare.length)];const pool=standard.length?standard:(rare.length?rare:cursed);return pool.length?pool[Math.floor(random()*pool.length)]:null;}

export class EliteRewardService{
 constructor({gameState,itemController=null,random=Math.random}){if(!gameState)throw new Error("L’état de partie est requis.");Object.assign(this,{gameState,itemController,random});}
 getRareChance(encounter){const difficulty=inferDifficulty(encounter);const difficultyBonus=difficulty==="hard"?.12:difficulty==="normal"?.05:0;const lucky=this.gameState.hasItem("lucky-coin")?(Number(getItemValues("lucky-coin",this.gameState.isItemUpgraded("lucky-coin"))?.rareBonus)||0):0;const cursed=this.gameState.hasItem("cursed-token")?(Number(getItemValues("cursed-token",this.gameState.isItemUpgraded("cursed-token"))?.rareBonus)||0):0;const eventBonus=this.gameState.consumeNextEliteRareChanceBonus?.()??0;return Math.min(.75,.05+difficultyBonus+lucky+cursed+eventBonus);}
 getGoldMultiplier(){return this.gameState.hasItem("clown-bet")?(Number(getItemValues("clown-bet",this.gameState.isItemUpgraded("clown-bet"))?.rewardMultiplier)||2):1;}
 createGoldReward(encounter){const base=randomInt(GOLD_RANGES[inferDifficulty(encounter)],this.random);return{type:"gold",amount:Math.round(base*this.getGoldMultiplier())};}
 createItemReward(excludedItemIds,rareChance){const item=weightedItem(getAvailableItems(excludedItemIds),rareChance,this.random);return item?{type:"item",itemId:item.id,item}:null;}
 createRoundOptions(encounter={},excludedItemIds=[]){const rareChance=this.getRareChance(encounter);const excluded=[...new Set([...this.gameState.inventory,...excludedItemIds])];return{gold:this.createGoldReward(encounter),item:this.createItemReward(excluded,rareChance),rareChance};}
 applyReward(reward){if(!reward)return null;if(reward.type==="gold"){this.gameState.addGold(reward.amount);return reward;}if(reward.type==="item"&&this.gameState.addItem(reward.itemId)){this.itemController?.ensureRuntimeState(reward.itemId);return reward;}return null;}
 completeElite(){this.gameState.elitesDefeated=(this.gameState.elitesDefeated??0)+1;return this.gameState.elitesDefeated;}
}
