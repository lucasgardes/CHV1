"use strict";

export const ITEM_TYPES = Object.freeze({
  CONSUMABLE: "consumable",
  RECHARGEABLE: "rechargeable",
  PASSIVE: "passive"
});

export const ITEMS = Object.freeze([
  {
    id: "controlled-breath",
    name: "Souffle contrôlé",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Réduit temporairement l’intensité de l’appareil pendant une séquence.",
    price: 140,
    rarity: "common",
    values: { intensityMultiplier: 0.75, rechargeRounds: 1 },
    upgrade: {
      description: "Réduit davantage l’intensité pendant la séquence.",
      values: { intensityMultiplier: 0.6, rechargeRounds: 1 }
    }
  },
  {
    id: "emergency-button",
    name: "Bouton d’urgence",
    type: ITEM_TYPES.CONSUMABLE,
    description: "Interrompt immédiatement une vidéo sans provoquer une défaite, mais inflige une importante pénalité.",
    price: 85,
    rarity: "common",
    values: { penaltyMultiplier: 1 },
    upgrade: {
      description: "Interrompt la vidéo avec une pénalité réduite.",
      values: { penaltyMultiplier: 0.5 }
    }
  },
  {
    id: "rhythm-analyzer",
    name: "Analyseur de rythme",
    type: ITEM_TYPES.PASSIVE,
    description: "Permet de visualiser le funscript pendant la lecture de la vidéo.",
    price: 180,
    rarity: "common",
    values: { showIntensityZones: false },
    upgrade: {
      description: "Ajoute des zones visuelles calmes, moyennes et intenses.",
      values: { showIntensityZones: true }
    }
  },
  {
    id: "last-stand",
    name: "Dernier rempart",
    type: ITEM_TYPES.PASSIVE,
    description: "Une fois par partie, transforme automatiquement une défaite en survie.",
    price: 220,
    rarity: "rare",
    values: { pauseSeconds: 0 },
    upgrade: {
      description: "Accorde une courte pause avant la reprise.",
      values: { pauseSeconds: 10 }
    }
  },
  {
    id: "time-out",
    name: "Temps mort",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Permet de mettre la vidéo en pause pendant 30 secondes.",
    price: 140,
    rarity: "common",
    values: { durationSeconds: 30, rechargeRounds: 1 },
    upgrade: {
      description: "Permet de mettre la vidéo en pause pendant 45 secondes.",
      values: { durationSeconds: 45, rechargeRounds: 1 }
    }
  },
  {
    id: "smoke-screen",
    name: "Écran de fumée",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Masque l’image pendant 5 secondes tout en conservant le son.",
    price: 130,
    rarity: "common",
    values: { durationSeconds: 5, rechargeRounds: 1 },
    upgrade: {
      description: "Masque l’image pendant 8 secondes tout en conservant le son.",
      values: { durationSeconds: 8, rechargeRounds: 1 }
    }
  },
  {
    id: "silencer",
    name: "Silencieux",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Coupe le son pendant 10 secondes tout en conservant l’image.",
    price: 135,
    rarity: "common",
    values: { durationSeconds: 10, rechargeRounds: 1 },
    upgrade: {
      description: "Coupe le son pendant 15 secondes tout en conservant l’image.",
      values: { durationSeconds: 15, rechargeRounds: 1 }
    }
  },
  {
    id: "cracked-stopwatch",
    name: "Chronomètre fissuré",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Permet de mettre la vidéo en pause pendant 15 secondes.",
    price: 145,
    rarity: "common",
    values: { durationSeconds: 15, rechargeRounds: 2 },
    upgrade: {
      description: "Conserve une pause de 15 secondes, mais recharge après une seule rencontre réussie.",
      values: { durationSeconds: 15, rechargeRounds: 1 }
    }
  }
]);

export function getItemById(itemId) {
  return ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getItemValues(itemId, upgraded = false) {
  const item = getItemById(itemId);
  if (item === null) return null;

  if (upgraded && item.upgrade?.values) {
    return { ...item.values, ...item.upgrade.values };
  }

  return { ...item.values };
}

export function getAvailableItems(ownedItemIds = []) {
  return ITEMS.filter((item) => !ownedItemIds.includes(item.id));
}

export function getRandomAvailableItem(ownedItemIds = []) {
  const availableItems = getAvailableItems(ownedItemIds);
  if (availableItems.length === 0) return null;
  return availableItems[Math.floor(Math.random() * availableItems.length)];
}
