"use strict";

import { getGameRuntime } from "../game/runtime-access.js";
import { EventItemActions } from "../game/event-item-actions.js";

export class EventView {
  constructor({ eventTitle, eventDescription, eventChoiceList, onChoiceSelected }) {
    if (!(eventTitle instanceof HTMLElement)) throw new Error("Le titre de l’événement est invalide.");
    if (!(eventDescription instanceof HTMLElement)) throw new Error("La description de l’événement est invalide.");
    if (!(eventChoiceList instanceof HTMLDivElement)) throw new Error("La liste des choix de l’événement est invalide.");
    if (typeof onChoiceSelected !== "function") throw new Error("onChoiceSelected doit être une fonction.");
    Object.assign(this, { eventTitle, eventDescription, eventChoiceList, onChoiceSelected });
    this.resolving = false;
  }

  render(event) {
    if (!event) throw new Error("L’événement à afficher est invalide.");
    this.currentEvent = event;
    this.resolving = false;
    this.eventTitle.textContent = event.title;
    this.eventDescription.textContent = event.description;
    this.eventChoiceList.replaceChildren();
    for (const choice of event.choices) this.appendChoice(event, choice);

    const runtime = getGameRuntime();
    const { gameState, itemController } = runtime;
    if (gameState?.hasItem("rigged-coin")) this.appendRuntimeAction("Utiliser la Pièce truquée", () => this.useRiggedCoin(event));
    if (gameState?.hasItem("blank-contract")) this.appendRuntimeAction("Utiliser le Contrat vierge", () => this.useBlankContract(event));
    if (gameState?.hasItem("escape-token") && itemController?.isAvailable("escape-token")) this.appendRuntimeAction("Utiliser le Jeton de fuite", () => runtime.runController?.escapeEvent("escape-token"));
    if (gameState?.hasItem("exit-ticket") && itemController?.isAvailable("exit-ticket")) this.appendRuntimeAction("Utiliser le Ticket de sortie", () => runtime.runController?.leaveCurrentRoom("exit-ticket"));
  }

  appendChoice(event, choice) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button";
    button.textContent = choice.label;
    button.addEventListener("click", async () => {
      if (this.resolving) return;
      this.resolving = true;
      this.disableChoices();
      try {
        await this.onChoiceSelected(event, choice);
      } catch (error) {
        this.resolving = false;
        this.enableChoices();
        throw error;
      }
    });
    this.eventChoiceList.append(button);
  }

  getEventItemActions() {
    const runtime = getGameRuntime();
    const eventEngine = globalThis.__CHV1_PHASE_ONE__?.getEventEngine?.();
    if (!runtime.gameState || !eventEngine) throw new Error("Le moteur d’événements n’est pas disponible.");
    return new EventItemActions({ gameState: runtime.gameState, eventEngine });
  }

  async useRiggedCoin(event) {
    const actions = this.getEventItemActions();
    const candidates = actions.useRiggedCoin(event);
    if (!candidates.length) { this.enableChoices(); return; }
    if (candidates.length === 1) {
      actions.commitReroll(candidates[0].id);
      this.render(candidates[0]);
      return;
    }
    this.eventTitle.textContent = "Pièce truquée";
    this.eventDescription.textContent = "Choisis le résultat que tu souhaites conserver.";
    this.eventChoiceList.replaceChildren();
    for (const candidate of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = candidate.title;
      button.addEventListener("click", () => { actions.commitReroll(candidate.id); this.render(candidate); });
      this.eventChoiceList.append(button);
    }
  }

  async useBlankContract(event) {
    const replaced = this.getEventItemActions().useBlankContract(event);
    if (!replaced) { this.enableChoices(); return; }
    this.render(replaced);
  }

  appendRuntimeAction(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button secondary-button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      if (this.resolving) return;
      this.resolving = true;
      this.disableChoices();
      try { await action(); }
      catch (error) { this.resolving = false; console.error(`Impossible d’exécuter « ${label} » :`, error); this.enableChoices(); }
    });
    this.eventChoiceList.append(button);
  }

  disableChoices() { for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = true; }
  enableChoices() { for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = false; }
}
