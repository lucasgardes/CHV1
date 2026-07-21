"use strict";

import { clamp } from "./funscript.js";

import {
  DEVICE_CONFIG
} from "./config.js";

export function supportsPositionControl(device) {
  if (device === null) {
    return false;
  }

  return (
    device.canOutput("Position") ||
    device.canOutput("HwPositionWithDuration")
  );
}

function findPositionFeature(device) {
  const positionFeature =
    device.features.outputs.find(
      (output) =>
        output.type === "HwPositionWithDuration"
    );

  if (positionFeature === undefined) {
    throw new Error(
      "Fonctionnalité HwPositionWithDuration introuvable."
    );
  }

  return positionFeature;
}

export async function sendPositionCommand(
  device,
  normalizedPosition,
  durationMilliseconds
) {
  if (device === null) {
    throw new Error("Aucun appareil sélectionné.");
  }

  const positionFeature =
    findPositionFeature(device);

  const safePosition = clamp(
    normalizedPosition,
    0,
    1
  );

  const safeDuration = Math.max(
    DEVICE_CONFIG.minimumCommandDurationMs,
    Math.round(durationMilliseconds)
  );

  await device.output({
    featureIndex: positionFeature.index,

    command: {
      HwPositionWithDuration: {
        Value: Math.round(safePosition * 100),
        Duration: safeDuration
      }
    }
  });
}

export async function stopDeviceSilently(device) {
  if (device === null) {
    return;
  }

  try {
    await device.stop();
  } catch (error) {
    console.error(
      "Impossible d'arrêter silencieusement l'appareil :",
      error
    );
  }
}

export async function stopDevice(
  device,
  client = null
) {
  if (device === null) {
    return {
      success: true,
      message: "Aucun appareil à arrêter."
    };
  }

  try {
    await device.stop();

    return {
      success: true,
      message: "Appareil arrêté."
    };
  } catch (deviceError) {
    console.error(
      "Erreur pendant l’arrêt de l’appareil :",
      deviceError
    );

    try {
      await client?.stopAll();

      return {
        success: true,
        message: "Tous les appareils ont été arrêtés."
      };
    } catch (fallbackError) {
      console.error(
        "L’arrêt général a également échoué :",
        fallbackError
      );

      return {
        success: false,
        message:
          "Échec de l’arrêt logiciel. Coupe l’appareil manuellement.",
        error: fallbackError
      };
    }
  }
}