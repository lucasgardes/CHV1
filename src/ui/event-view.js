"use strict";

import { getGameRuntime } from "../game/runtime-access.js";

export class EventView {
  constructor({ eventTitle, eventDescription, eventChoiceList, onChoiceSelected }) {
    if (!(eventTitle instanceof HTMLElement)) throw new Error("Le titre de l’événement est invalide.");
    if (!(eventDescription instanceof HTMLElement)) throw new Error("La description de l’événement est invalide.");
    if (!(eventChoiceList instanceof HTMLDivElement)) throw new Error("La liste des choix de l’événement est invalide.");
    if (typeof onChoiceSelected !== "function") throw new Error("onChoiceSelected doit être une fonction.");
    this.eventTitle = eventTitle;
    this.eventDescription = eventDescription;
    this.eventChoiceList = eventChoiceList;
    this.onChoiceSelected = onChoiceSelected;
  }

  render(event) {
    if (!event) throw new Error("L’événement à afficher est invalide.");
    this.eventTitle.textContent = event.title;
    this.eventDescription.textContent = event.description;
    this.eventChoiceList.replaceChildren();

    for (const choice of event.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = choice.label;
      button.addEventListener("click", () => { this.disableChoices(); this.onChoiceSelected(event, choice); });
      this.eventChoiceList.append(button);
    }

    const { gameState, itemController } = getGameRuntime();
    if (gameState?.hasItem("escape-token") && itemController?.isAvailable("escape-token")) {
      this.appendRuntimeAction("Utiliser le Jeton de fuite", () => getGameRuntime().runController?.escapeEvent("escape-token"));
    }
    if (gameState?.hasItem("exit-ticket") && itemController?.isAvailable("exit-ticket")) {
      this.appendRuntimeAction("Utiliser le Ticket de sortie", () => getGameRuntime().runController?.leaveCurrentRoom("exit-ticket"));
    }
  }

  appendRuntimeAction(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button secondary-button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      this.disableChoices();
      try { await action(); }
      catch (error) { console.error(`Impossible d’exécuter « ${label} » :`, error); this.enableChoices(); }
    });
    this.eventChoiceList.append(button);
  }

  disableChoices() { for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = true; }
  enableChoices() { for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = false; }
}
