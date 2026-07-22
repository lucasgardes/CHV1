"use strict";

export const ITEM_TYPES = Object.freeze({
  CONSUMABLE: "consumable",
  RECHARGEABLE: "rechargeable",
  PASSIVE: "passive"
});

export const RECHARGE_TYPES = Object.freeze({
  ENCOUNTERS: "encounters",
  ELITE: "elite",
  ONCE_PER_RUN: "once-per-run",
  NONE: "none"
});

export const ITEMS = Object.freeze([
  {
    id: "controlled-breath",
    name: "Souffle contrôlé",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Réduit temporairement l’intensité de l’appareil pendant une séquence.",
    price: 140,
    rarity: "common",
    effect: { type: "intensity-multiplier" },
    recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 1 },
    values: { intensityMultiplier: 0.75 },
    upgrade: {
      description: "Réduit davantage l’intensité pendant la séquence.",
      values: { intensityMultiplier: 0.6 }
    }
  },
  {
    id: "emergency-button",
    name: "Bouton d’urgence",
    type: ITEM_TYPES.CONSUMABLE,
    description: "Interrompt immédiatement une vidéo sans provoquer une défaite, mais inflige une importante pénalité.",
    price: 85,
    rarity: "common",
    effect: { type: "abort-encounter" },
    recharge: { type: RECHARGE_TYPES.NONE },
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
    effect: { type: "show-funscript" },
    recharge: { type: RECHARGE_TYPES.NONE },
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
    effect: { type: "prevent-defeat" },
    recharge: { type: RECHARGE_TYPES.ONCE_PER_RUN },
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
    effect: { type: "pause-video" },
    recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 1 },
    values: { durationSeconds: 30 },
    upgrade: {
      description: "Permet de mettre la vidéo en pause pendant 45 secondes.",
      values: { durationSeconds: 45 }
    }
  },
  {
    id: "smoke-screen",
    name: "Écran de fumée",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Masque l’image pendant quelques secondes sans interrompre le son ni le funscript.",
    price: 120,
    rarity: "common",
    effect: { type: "hide-video" },
    recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 1 },
    values: { durationSeconds: 5 },
    upgrade: {
      description: "Masque l’image plus longtemps.",
      values: { durationSeconds: 8 }
    }
  },
  {
    id: "silencer",
    name: "Silencieux",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Coupe temporairement le son sans interrompre la vidéo ni le funscript.",
    price: 125,
    rarity: "common",
    effect: { type: "mute-video" },
    recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 1 },
    values: { durationSeconds: 10 },
    upgrade: {
      description: "Coupe le son plus longtemps.",
      values: { durationSeconds: 15 }
    }
  },
  {
    id: "cracked-stopwatch",
    name: "Chronomètre fissuré",
    type: ITEM_TYPES.RECHARGEABLE,
    description: "Met la vidéo en pause pendant 15 secondes et se recharge lentement.",
    price: 110,
    rarity: "common",
    effect: { type: "pause-video" },
    recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 2 },
    values: { durationSeconds: 15 },
    upgrade: {
      description: "Se recharge après une seule rencontre réussie.",
      recharge: { type: RECHARGE_TYPES.ENCOUNTERS, amount: 1 },
      values: { durationSeconds: 15 }
    }
  }
]);

export function getItemById(itemId) {
  return ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getItemValues(itemId, upgraded = false) {
  const item = getItemById(itemId);
  if (item === null) return null;

  return upgraded && item.upgrade?.values
    ? { ...item.values, ...item.upgrade.values }
    : { ...item.values };
}

export function getItemRecharge(itemId, upgraded = false) {
  const item = getItemById(itemId);
  if (item === null) return null;

  if (upgraded && item.upgrade?.recharge) {
    return { ...item.recharge, ...item.upgrade.recharge };
  }

  return { ...item.recharge };
}

export function getAvailableItems(ownedItemIds = []) {
  return ITEMS.filter((item) => !ownedItemIds.includes(item.id));
}

export function getRandomAvailableItem(ownedItemIds = []) {
  const availableItems = getAvailableItems(ownedItemIds);
  if (availableItems.length === 0) return null;

  return availableItems[Math.floor(Math.random() * availableItems.length)];
}
