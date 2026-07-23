"use strict";

import { INITIAL_BLESSING_IDS } from "../data/blessings.js";

export const SAVE_KEY="chv1.phase1.save.v1";
const DEFAULT_META=Object.freeze({loopCount:0,victories:0,defeats:0,endingsSeen:[],discoveredArchives:[],unlockedContent:[],unlockedBlessingIds:INITIAL_BLESSING_IDS,lastEnding:null});
function cloneDefaultMeta(){return{...DEFAULT_META,endingsSeen:[],discoveredArchives:[],unlockedContent:[],unlockedBlessingIds:[...INITIAL_BLESSING_IDS]};}
export class LocalSaveService{
 constructor({storage=globalThis.localStorage,key=SAVE_KEY}={}){this.storage=storage;this.key=key;}
 load(){if(!this.storage)return cloneDefaultMeta();try{const parsed=JSON.parse(this.storage.getItem(this.key)||"null");if(!parsed||typeof parsed!=="object")return cloneDefaultMeta();return{...cloneDefaultMeta(),...parsed,endingsSeen:Array.isArray(parsed.endingsSeen)?[...new Set(parsed.endingsSeen)]:[],discoveredArchives:Array.isArray(parsed.discoveredArchives)?[...new Set(parsed.discoveredArchives)]:[],unlockedContent:Array.isArray(parsed.unlockedContent)?[...new Set(parsed.unlockedContent)]:[],unlockedBlessingIds:Array.isArray(parsed.unlockedBlessingIds)&&parsed.unlockedBlessingIds.length?[...new Set(parsed.unlockedBlessingIds)]:[...INITIAL_BLESSING_IDS]};}catch{return cloneDefaultMeta();}}
 save(meta){const normalized={...cloneDefaultMeta(),...meta};this.storage?.setItem(this.key,JSON.stringify(normalized));return normalized;}
 update(mutator){return this.save(mutator(this.load()));}
 clear(){this.storage?.removeItem(this.key);}
}
