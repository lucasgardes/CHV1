"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { BlessingService } from "../src/game/blessing-service.js";
import { INITIAL_BLESSING_IDS } from "../src/data/blessings.js";

function createSave(loopCount=0){let meta={loopCount,unlockedBlessingIds:[...INITIAL_BLESSING_IDS]};return{load(){return{...meta,unlockedBlessingIds:[...meta.unlockedBlessingIds]};},update(mutator){meta=mutator(this.load());return this.load();}};}
function createState(){return{gold:50,activeBlessingId:null,flags:{},setRunFlag(key,value){this.flags[key]=value;},getRunFlag(key){return this.flags[key];},addGold(amount){this.gold+=amount;return amount;}};}

test("aucune bénédiction n'est proposée pendant la première tentative",()=>{const service=new BlessingService({gameState:createState(),saveService:createSave(0)});assert.equal(service.shouldOffer(),false);});
test("trois bénédictions différentes sont proposées après la première boucle",()=>{const service=new BlessingService({gameState:createState(),saveService:createSave(1),random:()=>0.25});const offer=service.createOffer();assert.equal(offer.length,3);assert.equal(new Set(offer.map((entry)=>entry.id)).size,3);});
test("Main généreuse applique l'or de départ et le renouvellement gratuit",()=>{const state=createState();const service=new BlessingService({gameState:state,saveService:createSave(1)});service.select("generous-hand");assert.equal(state.gold,75);assert.equal(state.getRunFlag("blessing-free-first-reroll"),true);});
test("Présage favorable remplace la répartition des événements",()=>{const state=createState();const service=new BlessingService({gameState:state,saveService:createSave(1)});service.select("favorable-omen");assert.deepEqual(service.getEventWeights({positive:40,neutral:20,negative:40}),{positive:50,neutral:20,negative:30});});
test("la bénédiction active disparaît lorsque l'état de tentative est réinitialisé",()=>{const state=createState();const service=new BlessingService({gameState:state,saveService:createSave(1)});service.select("merchant-favor");assert.equal(state.activeBlessingId,"merchant-favor");state.activeBlessingId=null;assert.equal(service.getActive(),null);});
