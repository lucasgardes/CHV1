"use strict";

export const EVENTS = Object.freeze([
  {
    id: "event-001",
    title: "Bourse abandonnée",
    description:
      "Une petite bourse est posée au milieu du chemin. Elle semble étrangement facile à récupérer.",
    choices: [
      {
        id: "take-gold",
        label: "Prendre la bourse",
        effect: {
          type: "gain-gold",
          amount: 30
        }
      },
      {
        id: "leave",
        label: "Ne pas y toucher",
        effect: {
          type: "none"
        }
      }
    ]
  }
]);

export function getEventById(eventId) {
  return EVENTS.find(
    (event) => event.id === eventId
  ) ?? null;
}