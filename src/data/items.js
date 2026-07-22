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
    rarity: "common",
    values: {
      intensityMultiplier: 0.75,
      rechargeRounds: 1
    },
    upgrade: {
      description:
        "Réduit davantage l’intensité pendant la séquence.",
      values: {
        intensityMultiplier: 0.6,
        rechargeRounds: 1
      }
    }
  },
  {
    id: "emergency-button",
    name: "Bouton d’urgence",
    type: ITEM_TYPES.CONSUMABLE,
    description:
      "Interrompt immédiatement une vidéo sans provoquer une défaite, mais inflige une importante pénalité.",
    price: 85,
    rarity: "common",
    values: {
      penaltyMultiplier: 1
    },
    upgrade: {
      description:
        "Interrompt la vidéo avec une pénalité réduite.",
      values: {
        penaltyMultiplier: 0.5
      }
    }
  },
  {
    id: "rhythm-analyzer",
    name: "Analyseur de rythme",
    type: ITEM_TYPES.PASSIVE,
    description:
      "Permet de visualiser le funscript pendant la lecture de la vidéo.",
    price: 180,
    rarity: "common",
    values: {
      showIntensityZones: false
    },
    upgrade: {
      description:
        "Ajoute des zones visuelles calmes, moyennes et intenses.",
      values: {
        showIntensityZones: true
      }
    }
  },
  {
    id: "last-stand",
    name: "Dernier rempart",
    type: ITEM_TYPES.PASSIVE,
    description:
      "Une fois par partie, transforme automatiquement une défaite en survie.",
    price: 220,
    rarity: "rare",
    values: {
      pauseSeconds: 0
    },
    upgrade: {
      description:
        "Accorde une courte pause avant la reprise.",
      values: {
        pauseSeconds: 10
      }
    }
  },
  {
    id: "time-out",
    name: "Temps mort",
    type: ITEM_TYPES.RECHARGEABLE,
    description:
      "Permet de mettre la vidéo en pause pendant 30 secondes.",
    price: 140,
    rarity: "common",
    values: {
      durationSeconds: 30,
      rechargeRounds: 1
    },
    upgrade: {
      description:
        "Permet de mettre la vidéo en pause pendant 45 secondes.",
      values: {
        durationSeconds: 45,
        rechargeRounds: 1
      }
    }
  }
]);

export function getItemById(itemId) {
  return ITEMS.find(
    (item) => item.id === itemId
  ) ?? null;
}

export function getItemValues(itemId, upgraded = false) {
  const item = getItemById(itemId);

  if (item === null) {
    return null;
  }

  if (upgraded && item.upgrade?.values) {
    return {
      ...item.values,
      ...item.upgrade.values
    };
  }

  return { ...item.values };
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
