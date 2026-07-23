"use strict";

function isNegativeEffect(effect = {}) {
  return ["lose-gold", "lose-item", "lose-random-item", "difficulty-shift", "next-duration", "next-intensity", "disable-item", "disable-random-item"].includes(effect.type)
    || (effect.type === "compound" && (effect.effects ?? []).some(isNegativeEffect));
}

export class EventItemActions {
  constructor({ gameState, eventEngine }) {
    this.gameState = gameState;
    this.eventEngine = eventEngine;
  }

  useRiggedCoin(currentEvent) {
    if (!this.gameState.hasItem("rigged-coin")) return [];
    const count = this.gameState.isItemUpgraded("rigged-coin") ? 2 : 1;
    const candidates = this.eventEngine.previewMany(count, { excludedIds:[currentEvent.id] });
    if (!candidates.length) return [];
    this.gameState.removeItem("rigged-coin");
    return candidates;
  }

  commitReroll(eventId) {
    return this.eventEngine.commit(eventId);
  }

  useBlankContract(event) {
    if (!this.gameState.hasItem("blank-contract")) return null;
    const index = event.choices.findIndex((choice) => choice.negative === true || isNegativeEffect(choice.effect));
    if (index < 0) return null;
    const sourceEvent = this.eventEngine.preview({ excludedIds:[event.id] });
    const replacement = sourceEvent?.choices?.find((choice) => !isNegativeEffect(choice.effect)) ?? sourceEvent?.choices?.[0] ?? null;
    if (!replacement) return null;
    const upgraded = this.gameState.isItemUpgraded("blank-contract");
    this.gameState.removeItem("blank-contract");
    const choices = event.choices.map((choice, choiceIndex) => choiceIndex === index ? {
      ...replacement,
      id:`blank-contract-${replacement.id}`,
      label:upgraded ? `Option ${sourceEvent.category ?? "inconnue"} : ${replacement.label}` : "Option inconnue"
    } : choice);
    return { ...event, choices };
  }
}

export { isNegativeEffect };