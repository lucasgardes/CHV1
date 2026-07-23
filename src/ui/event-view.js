"use strict";

import { getGameRuntime } from "../game/runtime-access.js";
import { EventResolver } from "../game/event-resolver.js";
import { GAME_STATUS } from "../game/game-state.js";

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
      button.addEventListener("click", () => {
        this.disableChoices();
        void this.resolveChoice(event, choice);
      });
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

  async resolveChoice(event, choice) {
    const runtime = getGameRuntime();
    const basicEffects = new Set(["gain-gold", "none"]);
    if (basicEffects.has(choice.effect.type)) {
      this.onChoiceSelected(event, choice);
      return;
    }

    try {
      const resolver = new EventResolver({
        gameState: runtime.gameState,
        itemController: runtime.itemController,
        async startEncounter(encounterId, encounterType) {
          runtime.gameState.setCurrentEncounter({
            nodeId: runtime.gameState.currentNodeId,
            encounterId,
            type: encounterType
          });
          runtime.gameState.setStatus(GAME_STATUS.ENCOUNTER);
          runtime.screenController.showEncounter();
          const title = document.getElementById("encounter-title");
          if (title) title.textContent = "Rencontre imprévue";
          await runtime.encounterController.load(encounterId);
        }
      });
      const result = await resolver.resolve(choice.effect);

      if (choice.effect.type === "start-encounter") return;

      runtime.gameState.completeCurrentNode();
      runtime.gameState.setStatus(GAME_STATUS.MAP);
      runtime.screenController.showMap();
      runtime.mapView?.render({
        gameState: runtime.gameState,
        currentNode: runtime.mapController.getCurrentNode(),
        accessibleNodes: runtime.mapController.getAccessibleNodes()
      });

      const status = document.getElementById("video-status");
      if (status) status.textContent = this.describeResult(result);
    } catch (error) {
      console.error("Impossible de résoudre l’événement :", error);
      this.enableChoices();
    }
  }

  describeResult(result) {
    switch (result.type) {
      case "lose-gold": return `Événement terminé : ${result.amount} or perdu.`;
      case "gain-item": return result.itemId ? "Événement terminé : objet obtenu." : "Aucun objet disponible.";
      case "lose-item": return result.itemId ? "Événement terminé : un objet a été perdu." : "Aucun objet à perdre.";
      case "difficulty-shift": return "La difficulté de la prochaine rencontre a changé.";
      case "arm-protection": return "Une protection est active pour la prochaine rencontre.";
      default: return "Événement terminé.";
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
