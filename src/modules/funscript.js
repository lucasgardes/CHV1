"use strict";

/**
 * Limite une valeur entre un minimum et un maximum.
 */
export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Charge un fichier .funscript et retourne uniquement
 * ses actions valides, triées par timestamp.
 */
export async function loadFunscriptActions(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Erreur HTTP lors du chargement : ${response.status}`
    );
  }

  const funscript = await response.json();

  if (
    typeof funscript !== "object" ||
    funscript === null ||
    !Array.isArray(funscript.actions)
  ) {
    throw new Error(
      "Le fichier ne contient pas de tableau actions."
    );
  }

  const actions = funscript.actions
    .filter((action) => {
      return (
        typeof action === "object" &&
        action !== null &&
        Number.isFinite(action.at) &&
        Number.isFinite(action.pos)
      );
    })
    .map((action) => {
      return {
        at: Math.max(0, action.at),
        pos: clamp(action.pos, 0, 100)
      };
    })
    .sort((firstAction, secondAction) => {
      return firstAction.at - secondAction.at;
    });

  if (actions.length === 0) {
    throw new Error(
      "Le funscript ne contient aucune action valide."
    );
  }

  return actions;
}

/**
 * Trouve les deux actions qui encadrent le timestamp demandé.
 */
function findActionSegment(actions, timeMilliseconds) {
  if (actions.length === 0) {
    return null;
  }

  if (timeMilliseconds <= actions[0].at) {
    return {
      previousIndex: 0,
      nextIndex: 0
    };
  }

  const lastIndex = actions.length - 1;

  if (timeMilliseconds >= actions[lastIndex].at) {
    return {
      previousIndex: lastIndex,
      nextIndex: lastIndex
    };
  }

  let low = 0;
  let high = lastIndex;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const middleAction = actions[middle];

    if (middleAction.at === timeMilliseconds) {
      return {
        previousIndex: middle,
        nextIndex: middle
      };
    }

    if (middleAction.at < timeMilliseconds) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return {
    previousIndex: high,
    nextIndex: low
  };
}

/**
 * Calcule la position interpolée du funscript à un instant donné.
 */
export function calculatePositionAtTime(
  actions,
  timeMilliseconds
) {
  const segment = findActionSegment(
    actions,
    timeMilliseconds
  );

  if (segment === null) {
    return {
      position: 0,
      actionIndex: 0
    };
  }

  const previousAction =
    actions[segment.previousIndex];

  const nextAction =
    actions[segment.nextIndex];

  if (segment.previousIndex === segment.nextIndex) {
    return {
      position: previousAction.pos,
      actionIndex: segment.previousIndex
    };
  }

  const segmentDuration =
    nextAction.at - previousAction.at;

  if (segmentDuration <= 0) {
    return {
      position: nextAction.pos,
      actionIndex: segment.nextIndex
    };
  }

  const elapsedSincePrevious =
    timeMilliseconds - previousAction.at;

  const progress = clamp(
    elapsedSincePrevious / segmentDuration,
    0,
    1
  );

  return {
    position:
      previousAction.pos +
      (nextAction.pos - previousAction.pos) * progress,
    actionIndex: segment.previousIndex
  };
}

/**
 * Retourne l'index de la première action strictement postérieure
 * au timestamp, ou -1 si le funscript est terminé.
 */
export function findNextActionIndex(
  actions,
  timeMilliseconds
) {
  let low = 0;
  let high = actions.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (actions[middle].at <= timeMilliseconds) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low < actions.length ? low : -1;
}

/**
 * Convertit une position funscript 0–100 vers la plage
 * normalisée autorisée pour l'appareil.
 */
export function mapFunscriptPositionToDevice(
  position,
  minimumPosition,
  maximumPosition
) {
  const normalizedPosition = clamp(
    position / 100,
    0,
    1
  );

  return (
    minimumPosition +
    normalizedPosition *
      (maximumPosition - minimumPosition)
  );
}
