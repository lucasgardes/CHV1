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
    description:
      "Réduit temporairement l’intensité de l’appareil pendant une séquence.",
    price: 140,
    rarity: "common"
  },
  {
    id: "emergency-button",
    name: "Bouton d’urgence",
    type: ITEM_TYPES.CONSUMABLE,
    description:
      "Interrompt immédiatement une vidéo sans provoquer une défaite, mais inflige une importante pénalité.",
    price: 85,
    rarity: "common"
  },
  {
    id: "rhythm-analyzer",
    name: "Analyseur de rythme",
    type: ITEM_TYPES.PASSIVE,
    description:
      "Permet de visualiser le funscript pendant la lecture de la vidéo.",
    price: 180,
    rarity: "common"
  },
  {
    id: "last-stand",
    name: "Dernier rempart",
    type: ITEM_TYPES.PASSIVE,
    description:
      "Une fois par partie, transforme automatiquement une défaite en survie.",
    price: 220,
    rarity: "rare"
  },
  {
    id: "time-out",
    name: "Temps mort",
    type: ITEM_TYPES.RECHARGEABLE,
    description:
      "Permet de mettre la vidéo en pause pendant 30 secondes.",
    price: 140,
    rarity: "common"
  }
]);

export function getItemById(itemId) {
  return ITEMS.find(
    (item) => item.id === itemId
  ) ?? null;
}

export function getAvailableItems(
  ownedItemIds = []
) {
  return ITEMS.filter(
    (item) => !ownedItemIds.includes(item.id)
  );
}

export function getRandomAvailableItem(
  ownedItemIds = []
) {
  const availableItems =
    getAvailableItems(ownedItemIds);

  if (availableItems.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(
    Math.random() * availableItems.length
  );

  return availableItems[randomIndex];
}