"use strict";

export const ITEM_TYPES = Object.freeze({
  CONSUMABLE: "consumable",
  RECHARGEABLE: "rechargeable",
  PASSIVE: "passive"
});

export const RECHARGE_TYPES = Object.freeze({
  ENCOUNTERS: "encounters",
  ELITE: "elite",
  ELITE_OR_ENCOUNTERS: "elite-or-encounters",
  ONCE_PER_RUN: "once-per-run",
  NONE: "none"
});

export const ITEM_RARITIES = Object.freeze({ COMMON: "common", RARE: "rare", CURSED: "cursed" });

function item(config) {
  return Object.freeze({ rarity: ITEM_RARITIES.COMMON, implemented: false, ...config });
}

const C = ITEM_TYPES.CONSUMABLE;
const R = ITEM_TYPES.RECHARGEABLE;
const P = ITEM_TYPES.PASSIVE;
const NONE = Object.freeze({ type: RECHARGE_TYPES.NONE });

export const ITEMS = Object.freeze([
  item({ id:"emergency-button", name:"Bouton d’urgence", type:C, price:85, description:"Interrompt la rencontre sans défaite immédiate, avec une pénalité.", effect:{type:"abort-encounter"}, recharge:NONE, values:{penaltyMultiplier:1}, upgrade:{description:"Réduit la pénalité.", values:{penaltyMultiplier:.5}} }),
  item({ id:"detour-shoes", name:"Chaussures de détour", type:C, price:80, description:"Change de branche après avoir révélé le prochain choix.", effect:{type:"change-route"}, recharge:NONE, values:{range:1} }),
  item({ id:"shortcut-key", name:"Clé du raccourci", type:C, price:90, description:"Ouvre un raccourci ponctuel sur la carte.", effect:{type:"open-shortcut"}, recharge:NONE, values:{rows:1}, upgrade:{description:"Ouvre un raccourci plus avantageux.", values:{rows:2}} }),
  item({ id:"dubious-coupon", name:"Coupon douteux", type:C, price:75, description:"Accorde une forte réduction sur un achat, avec un risque.", effect:{type:"shop-coupon"}, recharge:NONE, values:{discount:.5, risk:.35}, upgrade:{description:"Réduit le risque.", values:{risk:.15}} }),
  item({ id:"rigged-coin", name:"Pièce truquée", type:C, price:80, description:"Force un résultat favorable lors d’un tirage aléatoire.", effect:{type:"force-positive-roll"}, recharge:NONE, values:{uses:1}, upgrade:{description:"Améliore le résultat forcé.", values:{qualityBonus:1}} }),
  item({ id:"blank-contract", name:"Contrat vierge", type:C, price:95, description:"Copie temporairement l’effet d’un objet proposé.", effect:{type:"copy-item-effect"}, recharge:NONE, values:{copyUpgrade:false}, upgrade:{description:"Copie aussi l’amélioration.", values:{copyUpgrade:true}} }),
  item({ id:"mini-checkpoint", name:"Mini-checkpoint", type:C, price:100, rarity:ITEM_RARITIES.RARE, description:"Permet de reprendre depuis la dernière case en cas de défaite.", effect:{type:"checkpoint"}, recharge:NONE, values:{keepRewards:false}, upgrade:{description:"Conserve une partie des récompenses.", values:{keepRewards:true}} }),
  item({ id:"second-chance", name:"Deuxième chance", type:C, price:100, rarity:ITEM_RARITIES.RARE, description:"Annule une défaite une fois.", effect:{type:"prevent-defeat-consumable"}, recharge:NONE, values:{pauseSeconds:0}, upgrade:{description:"Ajoute une pause de récupération.", values:{pauseSeconds:10}} }),
  item({ id:"delayed-protection", name:"Protection différée", type:C, price:85, description:"Protège automatiquement la prochaine rencontre.", effect:{type:"arm-next-encounter-protection"}, recharge:NONE, values:{intensityReduction:.2}, upgrade:{description:"Renforce la protection.", values:{intensityReduction:.35}} }),
  item({ id:"shortcut", name:"Raccourci", type:C, price:80, description:"Passe une rencontre normale sans récompense.", effect:{type:"skip-normal-node"}, recharge:NONE, values:{rewardMultiplier:0}, upgrade:{description:"Conserve une petite récompense.", values:{rewardMultiplier:.25}} }),
  item({ id:"fragmentation", name:"Fragmentation", type:C, price:85, description:"Divise une rencontre en deux segments avec une pause.", effect:{type:"split-encounter"}, recharge:NONE, values:{pauseSeconds:15}, upgrade:{description:"Allonge la pause.", values:{pauseSeconds:25}} }),
  item({ id:"reduced-difficulty", name:"Difficulté réduite", type:C, price:90, description:"Réduit la difficulté de la prochaine rencontre.", effect:{type:"reduce-next-difficulty"}, recharge:NONE, values:{intensityMultiplier:.8} }),
  item({ id:"room-swap", name:"Échange de salle", type:C, price:85, description:"Remplace une case accessible par un autre type compatible.", effect:{type:"swap-room"}, recharge:NONE, values:{choices:2}, upgrade:{description:"Propose davantage de remplacements.", values:{choices:3}} }),
  item({ id:"spyglass", name:"Longue-vue", type:C, price:75, description:"Révèle les détails des prochaines salles.", effect:{type:"reveal-map-details"}, recharge:NONE, values:{depth:2}, upgrade:{description:"Révèle plus loin.", values:{depth:3}} }),
  item({ id:"annotated-map", name:"Carte annotée", type:C, price:85, description:"Révèle les récompenses probables d’un chemin.", effect:{type:"reveal-route-rewards"}, recharge:NONE, values:{routes:1}, upgrade:{description:"Compare deux chemins.", values:{routes:2}} }),
  item({ id:"danger-detector", name:"Détecteur de danger", type:C, price:80, description:"Révèle la difficulté réelle d’une salle.", effect:{type:"reveal-danger"}, recharge:NONE, values:{nodes:1}, upgrade:{description:"Révèle plusieurs salles.", values:{nodes:3}} }),
  item({ id:"exit-ticket", name:"Ticket de sortie", type:C, price:90, description:"Quitte immédiatement une rencontre ou un événement sans récompense.", effect:{type:"leave-current-room"}, recharge:NONE, values:{penaltyGold:20}, upgrade:{description:"Supprime la pénalité en or.", values:{penaltyGold:0}} }),

  item({ id:"controlled-breath", name:"Souffle contrôlé", type:R, price:140, implemented:true, description:"Réduit temporairement l’intensité de l’appareil.", effect:{type:"intensity-multiplier"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:1}, values:{intensityMultiplier:.75,durationSeconds:20}, upgrade:{description:"Réduit davantage l’intensité.", values:{intensityMultiplier:.6,durationSeconds:25}} }),
  item({ id:"time-out", name:"Temps mort", type:R, price:140, implemented:true, description:"Met la vidéo en pause pendant 30 secondes.", effect:{type:"pause-video"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:1}, values:{durationSeconds:30}, upgrade:{description:"Pause de 45 secondes.", values:{durationSeconds:45}} }),
  item({ id:"smoke-screen", name:"Écran de fumée", type:R, price:120, implemented:true, description:"Masque l’image sans interrompre le son ni le funscript.", effect:{type:"hide-video"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:1}, values:{durationSeconds:5}, upgrade:{description:"Masque l’image plus longtemps.", values:{durationSeconds:8}} }),
  item({ id:"silencer", name:"Silencieux", type:R, price:125, implemented:true, description:"Coupe le son temporairement.", effect:{type:"mute-video"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:1}, values:{durationSeconds:10}, upgrade:{description:"Coupe le son plus longtemps.", values:{durationSeconds:15}} }),
  item({ id:"mirror-mode", name:"Mode miroir", type:R, price:150, implemented:true, description:"Inverse la courbe d’intensité du funscript pour le reste du round.", effect:{type:"mirror-intensity"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:2}, values:{cancelWindowSeconds:0}, upgrade:{description:"Autorise une annulation pendant cinq secondes.", values:{cancelWindowSeconds:5}} }),
  item({ id:"cracked-stopwatch", name:"Chronomètre fissuré", type:R, price:110, implemented:true, description:"Met la vidéo en pause pendant 15 secondes.", effect:{type:"pause-video"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:2}, values:{durationSeconds:15}, upgrade:{description:"Recharge après une rencontre.", recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:1}} }),
  item({ id:"hourglass", name:"Sablier", type:R, price:145, implemented:true, description:"Avance immédiatement la vidéo de 15 secondes.", effect:{type:"skip-video-seconds"}, recharge:{type:RECHARGE_TYPES.ENCOUNTERS,amount:2}, values:{seconds:15}, upgrade:{description:"Avance de 25 secondes.", values:{seconds:25}} }),
  item({ id:"escape-token", name:"Jeton de fuite", type:R, price:155, description:"Permet de quitter une case mystère sans accepter son effet.", effect:{type:"escape-event"}, recharge:{type:RECHARGE_TYPES.ELITE}, values:{classicRounds:0}, upgrade:{description:"Recharge aussi après trois rencontres classiques.", recharge:{type:RECHARGE_TYPES.ELITE_OR_ENCOUNTERS,amount:3}, values:{classicRounds:3}} }),

  item({ id:"last-stand", name:"Dernier rempart", type:P, price:230, rarity:ITEM_RARITIES.RARE, description:"Transforme une défaite en survie une fois par partie.", effect:{type:"prevent-defeat"}, recharge:{type:RECHARGE_TYPES.ONCE_PER_RUN}, values:{pauseSeconds:0}, upgrade:{description:"Ajoute une courte pause.", values:{pauseSeconds:10}} }),
  item({ id:"rhythm-analyzer", name:"Analyseur de rythme", type:P, price:180, implemented:true, description:"Affiche le funscript pendant la vidéo.", effect:{type:"show-funscript"}, recharge:NONE, values:{showIntensityZones:false}, upgrade:{description:"Affiche les zones d’intensité.", values:{showIntensityZones:true}} }),
  item({ id:"time-marker", name:"Repère temporel", type:P, price:165, implemented:true, description:"Affiche en permanence la progression de la vidéo.", effect:{type:"show-progress"}, recharge:NONE, values:{showRhythmMarkers:false}, upgrade:{description:"Ajoute les changements de rythme.", values:{showRhythmMarkers:true}} }),
  item({ id:"overheat-contract", name:"Contrat de surchauffe", type:P, price:190, description:"Augmente l’intensité maximale et l’or obtenu.", effect:{type:"max-intensity-and-gold"}, recharge:NONE, values:{intensityMultiplier:1.15,goldMultiplier:1.2}, upgrade:{description:"Augmente le bonus d’or sans plus d’intensité.", values:{goldMultiplier:1.35}} }),
  item({ id:"double-bet", name:"Double mise", type:P, price:210, description:"Permet de doubler les récompenses contre une difficulté supplémentaire.", effect:{type:"optional-double-reward"}, recharge:NONE, values:{difficultyMultiplier:1.2,rewardMultiplier:2}, upgrade:{description:"Réduit le malus de difficulté.", values:{difficultyMultiplier:1.12}} }),
  item({ id:"cursed-token", name:"Jeton maudit", type:P, price:180, rarity:ITEM_RARITIES.CURSED, description:"Augmente les objets rares et les événements négatifs.", effect:{type:"rarity-and-negative-events"}, recharge:NONE, values:{rareBonus:.08,negativeEventBonus:.15}, upgrade:{description:"Augmente encore les objets rares.", values:{rareBonus:.14}} }),
  item({ id:"loyalty-program", name:"Programme de fidélité", type:P, price:170, description:"Chaque achat réduit le prix du suivant.", effect:{type:"progressive-shop-discount"}, recharge:NONE, values:{discountPerPurchase:.05,maxDiscount:.2}, upgrade:{description:"Augmente la réduction.", values:{discountPerPurchase:.08,maxDiscount:.3}} }),
  item({ id:"leaky-wallet", name:"Porte-monnaie percé", type:P, price:175, description:"Augmente les gains d’or mais en fait perdre à chaque déplacement.", effect:{type:"gold-gain-and-move-loss"}, recharge:NONE, values:{goldMultiplier:1.25,goldLossPerMove:8}, upgrade:{description:"Réduit la perte par déplacement.", values:{goldLossPerMove:4}} }),
  item({ id:"lucky-coin", name:"Pièce porte-bonheur", type:P, price:190, description:"Augmente les chances d’obtenir des objets rares.", effect:{type:"rare-item-chance"}, recharge:NONE, values:{rareBonus:.08}, upgrade:{description:"Augmente davantage les chances.", values:{rareBonus:.14}} }),
  item({ id:"metronome", name:"Métronome", type:P, price:185, description:"Accorde un bonus croissant après des vidéos réussies sans secours.", effect:{type:"success-streak"}, recharge:NONE, values:{step:.05,max:.25}, upgrade:{description:"Le bonus progresse plus vite.", values:{step:.08,max:.35}} }),
  item({ id:"possessed-battery", name:"Batterie possédée", type:P, price:160, rarity:ITEM_RARITIES.CURSED, description:"Peut augmenter aléatoirement l’intensité.", effect:{type:"random-intensity-spike"}, recharge:NONE, values:{chance:.15,multiplier:1.2,goldBonus:0}, upgrade:{description:"Pics plus forts mais rémunérés.", values:{multiplier:1.3,goldBonus:8}} }),
  item({ id:"radio-silence", name:"Silence radio", type:P, price:0, rarity:ITEM_RARITIES.CURSED, description:"Empêche parfois l’utilisation des objets activables.", effect:{type:"disable-active-items-randomly"}, recharge:NONE, values:{chance:.2} }),
  item({ id:"director-eye", name:"Œil du réalisateur", type:P, price:210, description:"Permet de choisir entre deux vidéos avant une rencontre.", effect:{type:"choose-encounter-video"}, recharge:NONE, values:{choices:2,showDetails:false}, upgrade:{description:"Affiche durée et difficulté.", values:{showDetails:true}} }),
  item({ id:"last-act-key", name:"Clé du dernier acte", type:P, price:240, rarity:ITEM_RARITIES.RARE, description:"Ouvre un chemin secret ou un boss alternatif.", effect:{type:"unlock-secret-act"}, recharge:NONE, values:{enabled:true} }),
  item({ id:"broken-watch", name:"Montre cassée", type:P, price:195, implemented:true, description:"Réduit la durée des rencontres classiques.", effect:{type:"normal-duration-reduction"}, recharge:NONE, values:{seconds:30}, upgrade:{description:"Réduit de 45 secondes.", values:{seconds:45}} }),
  item({ id:"golden-hourglass", name:"Sablier doré", type:P, price:225, implemented:true, rarity:ITEM_RARITIES.RARE, description:"Réduit la durée de toutes les rencontres.", effect:{type:"all-duration-reduction"}, recharge:NONE, values:{seconds:15}, upgrade:{description:"Réduit de 25 secondes.", values:{seconds:25}} }),
  item({ id:"fast-path", name:"Chemin rapide", type:P, price:250, rarity:ITEM_RARITIES.RARE, description:"Permet de traverser une rencontre classique sans la jouer, une fois par ligne.", effect:{type:"skip-normal-once-per-row"}, recharge:NONE, values:{usesPerRow:1} }),
  item({ id:"elite-hunter", name:"Chasseur d’élites", type:P, price:185, implemented:true, description:"Réduit la durée des rencontres élites.", effect:{type:"elite-duration-reduction"}, recharge:NONE, values:{seconds:20}, upgrade:{description:"Réduit davantage la durée.", values:{seconds:35}} }),
  item({ id:"shop-regular", name:"Habitué des boutiques", type:P, price:180, implemented:true, description:"Réduit tous les prix en boutique.", effect:{type:"shop-discount"}, recharge:NONE, values:{discount:.1}, upgrade:{description:"Réduction accrue.", values:{discount:.15}} }),
  item({ id:"faithful-customer", name:"Client fidèle", type:P, price:175, implemented:true, description:"Réduit le premier achat de chaque boutique.", effect:{type:"first-shop-purchases-discount"}, recharge:NONE, values:{discount:.2,purchases:1}, upgrade:{description:"Réduit les deux premiers achats.", values:{purchases:2}} }),
  item({ id:"careful-explorer", name:"Explorateur prudent", type:P, price:170, description:"Indique la catégorie des événements mystère.", effect:{type:"reveal-event-category"}, recharge:NONE, values:{revealConsequence:false}, upgrade:{description:"Révèle une conséquence possible.", values:{revealConsequence:true}} }),
  item({ id:"experienced-camper", name:"Campeur expérimenté", type:P, price:190, description:"Ajoute une option au feu de camp.", effect:{type:"extra-campfire-option"}, recharge:NONE, values:{preview:false}, upgrade:{description:"Prévisualise le résultat.", values:{preview:true}} }),
  item({ id:"privileged-stock", name:"Stock privilégié", type:P, price:190, implemented:true, description:"Ajoute un objet à chaque boutique.", effect:{type:"extra-shop-slot"}, recharge:NONE, values:{slots:1,rareBonus:0}, upgrade:{description:"Augmente la rareté du nouvel emplacement.", values:{rareBonus:.1}} }),
  item({ id:"scout", name:"Éclaireur", type:P, price:165, description:"Révèle des salles supplémentaires sur la carte.", effect:{type:"extra-map-reveal"}, recharge:NONE, values:{depth:1}, upgrade:{description:"Révèle deux salles.", values:{depth:2}} }),
  item({ id:"utility-belt", name:"Ceinture utilitaire", type:P, price:170, description:"Augmente la capacité d’objets activables.", effect:{type:"active-item-capacity"}, recharge:NONE, values:{slots:1}, upgrade:{description:"Ajoute deux emplacements.", values:{slots:2}} }),
  item({ id:"recycler", name:"Recycleur", type:P, price:190, description:"Donne une chance de conserver le premier consommable de la période.", effect:{type:"preserve-consumable"}, recharge:NONE, values:{chance:.25,period:"elite"}, upgrade:{description:"Augmente la probabilité.", values:{chance:.45}} }),
  item({ id:"external-battery", name:"Batterie externe", type:P, price:215, implemented:true, rarity:ITEM_RARITIES.RARE, description:"Réduit les temps de recharge des objets.", effect:{type:"recharge-reduction"}, recharge:NONE, values:{rounds:1,secondaryReduction:0}, upgrade:{description:"Réduit aussi un autre compteur lorsqu’une recharge est immédiate.", values:{secondaryReduction:1}} }),
  item({ id:"double-command", name:"Double commande", type:P, price:240, rarity:ITEM_RARITIES.RARE, description:"Permet une seconde utilisation gratuite une fois par partie.", effect:{type:"repeat-active-item"}, recharge:{type:RECHARGE_TYPES.ONCE_PER_RUN}, values:{mustBeConsecutive:true}, upgrade:{description:"Les utilisations peuvent être séparées.", values:{mustBeConsecutive:false}} }),
  item({ id:"clown-bet", name:"Pari du clown", type:P, price:210, description:"Double les récompenses d’élite mais allonge leurs vidéos.", effect:{type:"elite-reward-and-duration"}, recharge:NONE, values:{rewardMultiplier:2,extraSeconds:30}, upgrade:{description:"Réduit l’allongement.", values:{extraSeconds:15}} }),
  item({ id:"overconfidence", name:"Confiance excessive", type:P, price:185, description:"Raccourcit les rencontres classiques mais allonge le boss.", effect:{type:"normal-shorter-boss-longer"}, recharge:NONE, values:{normalReductionSeconds:25,bossExtraSeconds:45}, upgrade:{description:"Réduit l’allongement du boss.", values:{bossExtraSeconds:25}} })
]);

export function getItemById(itemId) { return ITEMS.find((entry) => entry.id === itemId) ?? null; }
export function getItemValues(itemId, upgraded = false) {
  const found = getItemById(itemId); if (!found) return null;
  return upgraded && found.upgrade?.values ? { ...found.values, ...found.upgrade.values } : { ...found.values };
}
export function getItemRecharge(itemId, upgraded = false) {
  const found = getItemById(itemId); if (!found) return null;
  return upgraded && found.upgrade?.recharge ? { ...found.recharge, ...found.upgrade.recharge } : { ...found.recharge };
}
export function getAvailableItems(ownedItemIds = []) { return ITEMS.filter((entry) => !ownedItemIds.includes(entry.id) && entry.price > 0); }
export function getRandomAvailableItem(ownedItemIds = []) {
  const available = getAvailableItems(ownedItemIds); return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}
