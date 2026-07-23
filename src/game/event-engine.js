"use strict";

export const EVENT_CATEGORY_WEIGHTS = Object.freeze({ positive: 40, neutral: 20, negative: 40 });

function weightedPick(entries, random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.value;
  }
  return entries.at(-1)?.value ?? null;
}

export class EventEngine {
  constructor({ events, gameState, random = Math.random, categoryWeights = EVENT_CATEGORY_WEIGHTS }) {
    if (!Array.isArray(events) || !events.length) throw new Error("La liste d’événements est vide.");
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.events = events;
    this.gameState = gameState;
    this.random = random;
    this.categoryWeights = { ...EVENT_CATEGORY_WEIGHTS, ...categoryWeights };
  }

  getAvailableEvents() {
    return this.events.filter((event) => !this.gameState.hasSeenEvent(event.id));
  }

  draw({ category = null } = {}) {
    let available = this.getAvailableEvents();
    if (!available.length) return null;
    const categories = [...new Set(available.map((event) => event.category ?? "neutral"))];
    const selectedCategory = category ?? weightedPick(categories.map((value) => ({ value, weight: this.categoryWeights[value] ?? 0 })), this.random);
    const matching = available.filter((event) => (event.category ?? "neutral") === selectedCategory);
    if (matching.length) available = matching;
    const event = available[Math.floor(this.random() * available.length)] ?? null;
    if (event) this.gameState.markEventSeen(event.id);
    return event;
  }

  assignToNodes(nodes = []) {
    return nodes.filter((node) => node.type === "event").map((node) => {
      const event = this.draw();
      if (!event) return null;
      node.eventId = event.id;
      node.eventCategory = event.category ?? "neutral";
      return { nodeId: node.id, eventId: event.id };
    }).filter(Boolean);
  }
}