"use strict";

import { getGameRuntime } from "../game/runtime-access.js";
import { EventResolver } from "../game/event-resolver.js";
import { EventItemActions } from "../game/event-item-actions.js";
import { GAME_STATUS } from "../game/game-state.js";

export class EventView {
  constructor({ eventTitle, eventDescription, eventChoiceList, onChoiceSelected }) {
    if (!(eventTitle instanceof HTMLElement)) throw new Error("Le titre de l’événement est invalide.");
    if (!(eventDescription instanceof HTMLElement)) throw new Error("La description de l’événement est invalide.");
    if (!(eventChoiceList instanceof HTMLDivElement)) throw new Error("La liste des choix de l’événement est invalide.");
    if (typeof onChoiceSelected !== "function") throw new Error("onChoiceSelected doit être une fonction.");
    Object.assign(this, { eventTitle, eventDescription, eventChoiceList, onChoiceSelected });
    this.resolving = false;
    this.eventNodeId = null;
  }

  render(event) {
    if (!event) throw new Error("L’événement à afficher est invalide.");
    const runtime = getGameRuntime();
    this.currentEvent = event;
    this.eventNodeId = runtime.gameState?.currentNodeId ?? null;
    this.resolving = false;
    this.eventTitle.textContent = event.title;
    this.eventDescription.textContent = event.description;
    this.eventChoiceList.replaceChildren();
    for (const choice of event.choices) this.appendChoice(event, choice);

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
      try { await this.resolveChoice(choice); }
      catch (error) {
        this.resolving = false;
        console.error("Impossible de résoudre l’événement :", error);
        this.enableChoices();
      }
    });
    this.eventChoiceList.append(button);
  }

  async unlockGalleryRewards(choice) {
    const rewardIds = Array.isArray(choice?.effect?.galleryRewardIds)
      ? choice.effect.galleryRewardIds.filter(Boolean)
      : [];
    for (const imageId of rewardIds) {
      window.dispatchEvent(new CustomEvent("chv1:image-unlocked", {
        detail: {
          id: imageId,
          origin: `Événement : ${this.currentEvent?.title ?? this.currentEvent?.id ?? "inconnu"}`,
          snapshot: {
            eventId: this.currentEvent?.id ?? null,
            eventTitle: this.currentEvent?.title ?? null,
            choiceId: choice.id ?? null,
            choiceLabel: choice.label ?? null
          }
        }
      }));
    }
  }

  async resolveChoice(choice) {
    const runtime = getGameRuntime();
    const { gameState, itemController, mapController, screenController, mapView } = runtime;
    if (!gameState || !mapController || !screenController) throw new Error("Le moteur de partie n’est pas disponible.");
    if (gameState.status !== GAME_STATUS.EVENT) throw new Error("Aucun événement n’est actuellement ouvert.");
    if (!this.eventNodeId || gameState.currentNodeId !== this.eventNodeId) throw new Error("La position de l’événement a changé pendant sa résolution.");

    const resolver = new EventResolver({
      gameState,
      itemController,
      async startEncounter(encounterId, encounterType) {
        gameState.setCurrentEncounter({ nodeId: gameState.currentNodeId, encounterId, type: encounterType });
        gameState.setStatus(GAME_STATUS.ENCOUNTER);
        screenController.showEncounter();
        const title = document.getElementById("encounter-title");
        if (title) title.textContent = "Rencontre imprévue";
        await runtime.encounterController.load(encounterId);
      }
    });

    const result = await resolver.resolve(choice.effect);
    if (choice.effect.type === "start-encounter") return;

    await this.unlockGalleryRewards(choice);
    gameState.completeCurrentNode();
    gameState.setStatus(GAME_STATUS.MAP);
    screenController.showMap();
    mapView?.render({
      gameState,
      currentNode: mapController.getCurrentNode(),
      accessibleNodes: mapController.getAccessibleNodes()
    });

    const status = document.getElementById("video-status");
    if (status) status.textContent = this.describeResult(result);
    window.dispatchEvent(new CustomEvent("chv1:event-completed", {
      detail: {
        nodeId: this.eventNodeId,
        eventId: this.currentEvent?.id ?? null,
        eventTitle: this.currentEvent?.title ?? null,
        choiceId: choice.id ?? null,
        choiceLabel: choice.label ?? null,
        galleryRewardIds: [...(choice.effect.galleryRewardIds ?? [])],
        result
      }
    }));
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
    if (!candidates.length) { this.resolving = false; this.enableChoices(); return; }
    if (candidates.length === 1) { actions.commitReroll(candidates[0].id); this.render(candidates[0]); return; }
    this.eventTitle.textContent = "Pièce truquée";
    this.eventDescription.textContent = "Choisis le résultat que tu souhaites conserver.";
    this.eventChoiceList.replaceChildren();
    this.resolving = false;
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
    if (!replaced) { this.resolving = false; this.enableChoices(); return; }
    this.render(replaced);
  }

  describeResult(result) {
    switch (result?.type) {
      case "gain-gold": return `Événement terminé : +${result.amount} or.`;
      case "lose-gold": return `Événement terminé : ${result.amount} or perdu.`;
      case "gain-item": return result.itemId ? "Événement terminé : objet obtenu." : "Aucun objet disponible.";
      case "lose-item": return result.itemId ? "Événement terminé : un objet a été perdu." : "Aucun objet à perdre.";
      case "difficulty-shift": return "La difficulté de la prochaine rencontre a changé.";
      case "arm-protection": return "Une protection est active pour la prochaine rencontre.";
      case "next-duration": return "La durée de la prochaine rencontre a changé.";
      case "next-reward": return "La prochaine récompense a changé.";
      case "disable-item": return result.itemId ? "Un objet est temporairement désactivé." : "Aucun objet compatible.";
      case "none": return "Événement terminé sans conséquence.";
      default: return "Événement terminé.";
    }
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
