"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {EliteRewardService} from "../src/game/elite-reward-service.js";

function state(overrides={}){return{inventory:[],upgradedItemIds:[],elitesDefeated:0,nextEliteRareChanceBonus:0,gold:50,hasItem(id){return this.inventory.includes(id);},isItemUpgraded(id){return this.upgradedItemIds.includes(id);},addItem(id){if(this.inventory.includes(id))return false;this.inventory.push(id);return true;},addGold(amount){this.gold+=amount;},consumeNextEliteRareChanceBonus(){const value=this.nextEliteRareChanceBonus;this.nextEliteRareChanceBonus=0;return value;},...overrides};}

test("chaque manche propose de l or et un objet",()=>{const service=new EliteRewardService({gameState:state(),random:()=>0});const options=service.createRoundOptions({difficulty:2});assert.equal(options.gold.type,"gold");assert.equal(options.item.type,"item");});

test("le second objet exclut le premier objet propose",()=>{const service=new EliteRewardService({gameState:state(),random:()=>0});const first=service.createRoundOptions({difficulty:2});const second=service.createRoundOptions({difficulty:2},[first.item.itemId]);assert.notEqual(second.item?.itemId,first.item.itemId);});

test("un objet deja possede ne peut pas etre propose",()=>{const gameState=state({inventory:["time-out"]});const service=new EliteRewardService({gameState,random:()=>0});const options=service.createRoundOptions({difficulty:2});assert.notEqual(options.item?.itemId,"time-out");});

test("un elite difficile augmente la chance rare",()=>{const easy=new EliteRewardService({gameState:state(),random:()=>.5}).getRareChance({difficulty:1});const hard=new EliteRewardService({gameState:state(),random:()=>.5}).getRareChance({difficulty:3});assert.ok(hard>easy);});

test("le pari du clown double les recompenses en or",()=>{const normal=new EliteRewardService({gameState:state(),random:()=>0}).createGoldReward({difficulty:2});const clown=new EliteRewardService({gameState:state({inventory:["clown-bet"]}),random:()=>0}).createGoldReward({difficulty:2});assert.equal(clown.amount,normal.amount*2);});

test("les choix sont appliques separement puis l elite est comptee",()=>{const gameState=state();const controller={initialized:[],ensureRuntimeState(id){this.initialized.push(id);}};const service=new EliteRewardService({gameState,itemController:controller});service.applyReward({type:"item",itemId:"time-out",item:{id:"time-out"}});service.applyReward({type:"gold",amount:60});service.completeElite();assert.deepEqual(gameState.inventory,["time-out"]);assert.equal(gameState.gold,110);assert.equal(gameState.elitesDefeated,1);});
