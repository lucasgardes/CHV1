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

  getAvailableEvents(excludedIds = []) {
    return this.events.filter((event) => !this.gameState.hasSeenEvent(event.id) && !excludedIds.includes(event.id));
  }

  selectFromPool(available, category = null) {
    if (!available.length) return null;
    const categories = [...new Set(available.map((event) => event.category ?? "neutral"))];
    const selectedCategory = category ?? weightedPick(categories.map((value) => ({ value, weight: this.categoryWeights[value] ?? 0 })), this.random);
    const matching = available.filter((event) => (event.category ?? "neutral") === selectedCategory);
    const pool = matching.length ? matching : available;
    return pool[Math.floor(this.random() * pool.length)] ?? null;
  }

  preview({ category = null, excludedIds = [] } = {}) {
    return this.selectFromPool(this.getAvailableEvents(excludedIds), category);
  }

  draw({ category = null, excludedIds = [] } = {}) {
    const event = this.preview({ category, excludedIds });
    if (event) this.gameState.markEventSeen(event.id);
    return event;
  }

  previewMany(count = 2, options = {}) {
    const selected = [];
    for (let index = 0; index < count; index += 1) {
      const event = this.preview({ ...options, excludedIds:[...(options.excludedIds ?? []), ...selected.map((entry) => entry.id)] });
      if (!event) break;
      selected.push(event);
    }
    return selected;
  }

  commit(eventId) {
    const event = this.events.find((entry) => entry.id === eventId) ?? null;
    if (event) this.gameState.markEventSeen(event.id);
    return event;
  }

  assignToNodes(nodes = []) {
    return nodes.filter((node) => node.type === "event").map((node) => {
      const event = this.draw();
      if (!event) return null;
      node.eventId = event.id;
      node.eventCategory = event.category ?? "neutral";
      return { nodeId:node.id, eventId:event.id };
    }).filter(Boolean);
  }
}