"use strict";

import { BLESSINGS, BLESSING_RARITIES, INITIAL_BLESSING_IDS, getBlessingById } from "../data/blessings.js";

function shuffle(values,random){const copy=[...values];for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}

export class BlessingService{
 constructor({gameState,saveService,random=Math.random}={}){if(!gameState||!saveService)throw new Error("L’état de partie et la sauvegarde sont requis.");Object.assign(this,{gameState,saveService,random});}
 getUnlockedIds(){const meta=this.saveService.load();const ids=Array.isArray(meta.unlockedBlessingIds)&&meta.unlockedBlessingIds.length?meta.unlockedBlessingIds:INITIAL_BLESSING_IDS;return ids.filter((id)=>getBlessingById(id));}
 ensureInitialUnlocks(){return this.saveService.update((meta)=>({...meta,unlockedBlessingIds:[...new Set([...(meta.unlockedBlessingIds??[]),...INITIAL_BLESSING_IDS])]}));}
 shouldOffer(){return(Number(this.saveService.load().loopCount)||0)>=1;}
 createOffer(count=3){const pool=shuffle(this.getUnlockedIds().map(getBlessingById).filter(Boolean),this.random);const selected=[];for(const blessing of pool){if(selected.length>=count)break;if(selected.length===2&&selected.every((entry)=>entry.rarity===BLESSING_RARITIES.UNSTABLE)&&blessing.rarity===BLESSING_RARITIES.UNSTABLE)continue;if(selected.some((entry)=>entry.category===blessing.category)&&pool.some((candidate)=>candidate.category!==blessing.category&&!selected.includes(candidate)))continue;selected.push(blessing);}for(const blessing of pool){if(selected.length>=count)break;if(!selected.includes(blessing))selected.push(blessing);}return selected.slice(0,count);}
 select(blessingId){const blessing=getBlessingById(blessingId);if(!blessing||!this.getUnlockedIds().includes(blessingId))throw new Error("Bénédiction indisponible.");this.gameState.activeBlessingId=blessingId;this.applyStartEffect(blessing);return blessing;}
 getActive(){return getBlessingById(this.gameState.activeBlessingId);}
 has(id){return this.gameState.activeBlessingId===id;}
 applyStartEffect(blessing=this.getActive()){if(!blessing)return null;switch(blessing.effect.type){case"starting-gold-and-free-reroll":this.gameState.gold+=blessing.effect.gold;this.gameState.setRunFlag("blessing-free-first-reroll",true);break;case"starting-item-choice":this.gameState.setRunFlag("starting-item-choice-count",blessing.effect.choices);break;case"reveal-branch-encounters":this.gameState.setRunFlag("reveal-branch-encounters",true);break;case"lower-normal-difficulty":this.gameState.setRunFlag("lower-normal-difficulty",true);break;}return blessing;}
 getGoldMultiplier(){return this.has("revenant-fortune")?1.15:1;}
 getShopDiscount(){return this.has("merchant-favor")?.1:0;}
 getEncounterDurationAdjustment(type){if(this.has("breath-of-mercy")){if(type==="normal")return-10;if(type==="elite")return-15;}if(this.has("temporal-debt")){if(type==="normal")return-15;if(type==="boss")return 45;}return 0;}
 getEventWeights(defaults){return this.has("favorable-omen")?{...defaults,positive:50,neutral:20,negative:30}:{...defaults};}
 onPositiveEvent(){if(!this.has("rewarded-curiosity")||this.gameState.getRunFlag("rewarded-curiosity-used"))return 0;this.gameState.setRunFlag("rewarded-curiosity-used",true);this.gameState.addGold(30,{ignoreBlessing:true});return 30;}
 onEliteCompleted(itemController){if(!this.has("second-wind"))return[];return itemController?.reduceRechargeCounters?.(1)??[];}
 onCampfireOpened(itemController){if(!this.has("rest-grace"))return false;itemController?.rechargeAll();return true;}
}
