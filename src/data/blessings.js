"use strict";

export const BLESSING_RARITIES=Object.freeze({COMMON:"common",RARE:"rare",UNSTABLE:"unstable"});
export const BLESSING_CATEGORIES=Object.freeze({ECONOMY:"economy",MAP:"map",ITEMS:"items",ENCOUNTERS:"encounters",EVENTS:"events",CAMPFIRE:"campfire"});
function blessing(config){return Object.freeze(config);}
export const BLESSINGS=Object.freeze([
 blessing({id:"revenant-fortune",name:"Fortune du revenant",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.ECONOMY,description:"Tous les gains d’or sont augmentés de 15 %.",effect:{type:"gold-multiplier",multiplier:1.15}}),
 blessing({id:"generous-hand",name:"Main généreuse",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.ECONOMY,description:"Commence avec 25 or supplémentaires et le premier renouvellement de chaque boutique est gratuit.",effect:{type:"starting-gold-and-free-reroll",gold:25}}),
 blessing({id:"merchant-favor",name:"Faveur des marchands",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.ECONOMY,description:"Les prix des boutiques sont réduits de 10 %.",effect:{type:"shop-discount",discount:.1}}),
 blessing({id:"forgotten-legacy",name:"Héritage oublié",rarity:BLESSING_RARITIES.RARE,category:BLESSING_CATEGORIES.ITEMS,description:"Le choix d’objet de départ contient quatre objets au lieu de trois.",effect:{type:"starting-item-choice",choices:4}}),
 blessing({id:"other-path-memory",name:"Souvenir d’un autre chemin",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.MAP,description:"Révèle difficulté et durée des premières rencontres après chaque embranchement.",effect:{type:"reveal-branch-encounters"}}),
 blessing({id:"peaceful-route",name:"Route apaisée",rarity:BLESSING_RARITIES.RARE,category:BLESSING_CATEGORIES.MAP,description:"Les rencontres normales ont davantage de chances d’être moins difficiles.",effect:{type:"lower-normal-difficulty"}}),
 blessing({id:"breath-of-mercy",name:"Souffle de clémence",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.ENCOUNTERS,description:"Réduit les normales de 10 s et les élites de 15 s.",effect:{type:"duration-reduction",normalSeconds:10,eliteSeconds:15}}),
 blessing({id:"second-wind",name:"Deuxième souffle",rarity:BLESSING_RARITIES.RARE,category:BLESSING_CATEGORIES.ITEMS,description:"Après chaque élite, réduit d’un round la recharge de tous les rechargeables.",effect:{type:"elite-recharge-reduction",rounds:1}}),
 blessing({id:"rest-grace",name:"Grâce du repos",rarity:BLESSING_RARITIES.RARE,category:BLESSING_CATEGORIES.CAMPFIRE,description:"Les feux de camp rechargent automatiquement tous les rechargeables avant le choix.",effect:{type:"campfire-auto-recharge"}}),
 blessing({id:"favorable-omen",name:"Présage favorable",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.EVENTS,description:"Les événements sont répartis à 50 % positifs, 20 % neutres et 30 % négatifs.",effect:{type:"event-weights",positive:50,neutral:20,negative:30}}),
 blessing({id:"rewarded-curiosity",name:"Curiosité récompensée",rarity:BLESSING_RARITIES.COMMON,category:BLESSING_CATEGORIES.EVENTS,description:"Le premier événement résolu positivement donne 30 or supplémentaires.",effect:{type:"first-positive-event-gold",gold:30}}),
 blessing({id:"temporal-debt",name:"Dette temporelle",rarity:BLESSING_RARITIES.UNSTABLE,category:BLESSING_CATEGORIES.ENCOUNTERS,description:"Toutes les normales sont réduites de 15 s, mais le boss dure 45 s de plus.",effect:{type:"normal-shorter-boss-longer",normalSeconds:15,bossSeconds:45}})
]);
export const INITIAL_BLESSING_IDS=Object.freeze(BLESSINGS.map((entry)=>entry.id));
export function getBlessingById(id){return BLESSINGS.find((entry)=>entry.id===id)??null;}
