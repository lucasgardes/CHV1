"use strict";

import { getItemById } from "../data/items.js";
import { getGameRuntime } from "../game/runtime-access.js";
import { EventResolver } from "../game/event-resolver.js";
import { EventItemActions } from "../game/event-item-actions.js";
import { GAME_STATUS } from "../game/game-state.js";

function replaceSelectedItem(value, itemId) {
  if (Array.isArray(value)) return value.map((entry) => replaceSelectedItem(entry, itemId));
  if (!value || typeof value !== "object") return value === "$selectedItemId" ? itemId : value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceSelectedItem(entry, itemId)]));
}

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

  getOwnedCandidates(effect) {
    const { gameState } = getGameRuntime();
    return (gameState?.inventory ?? [])
      .map((itemId) => getItemById(itemId))
      .filter((item) => item && (!effect.itemType || item.type === effect.itemType));
  }

  appendChoice(event, choice) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button";
    button.textContent = choice.label;
    if (choice.effect?.type === "choose-owned-item" && this.getOwnedCandidates(choice.effect).length === 0) {
      button.disabled = true;
      button.title = choice.effect.unavailableLabel || "Aucun objet compatible.";
    }
    button.addEventListener("click", async () => {
      if (this.resolving) return;
      if (choice.effect?.type === "choose-owned-item") {
        this.showOwnedItemSelection(choice);
        return;
      }
      this.resolving = true;
      this.disableChoices();
      try { await this.resolveChoice(choice, choice.effect); }
      catch (error) {
        this.resolving = false;
        console.error("Impossible de résoudre l’événement :", error);
        this.enableChoices();
      }
    });
    this.eventChoiceList.append(button);
  }

  showOwnedItemSelection(choice) {
    const candidates = this.getOwnedCandidates(choice.effect);
    if (!candidates.length) return;
    this.eventTitle.textContent = choice.effect.selectionTitle || "Choisir un objet";
    this.eventDescription.textContent = choice.effect.prompt || "Sélectionne l’objet concerné.";
    this.eventChoiceList.replaceChildren();

    for (const item of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = item.name;
      button.addEventListener("click", async () => {
        if (this.resolving) return;
        this.resolving = true;
        this.disableChoices();
        const effects = [choice.effect.selectedEffect, ...(choice.effect.afterEffects || [])]
          .filter(Boolean)
          .map((effect) => replaceSelectedItem(effect, item.id));
        const resolvedEffect = effects.length === 1 ? effects[0] : { type:"compound", effects };
        try { await this.resolveChoice(choice, resolvedEffect, { selectedItemId:item.id, selectedItemName:item.name }); }
        catch (error) {
          this.resolving = false;
          console.error("Impossible d’appliquer le choix d’objet :", error);
          this.render(this.currentEvent);
        }
      });
      this.eventChoiceList.append(button);
    }

    const back = document.createElement("button");
    back.type = "button";
    back.className = "event-choice-button secondary-button";
    back.textContent = "Retour";
    back.addEventListener("click", () => this.render(this.currentEvent));
    this.eventChoiceList.append(back);
  }

  async unlockGalleryRewards(choice) {
    const rewardIds = Array.isArray(choice?.effect?.galleryRewardIds) ? choice.effect.galleryRewardIds.filter(Boolean) : [];
    for (const imageId of rewardIds) {
      window.dispatchEvent(new CustomEvent("chv1:image-unlocked", {
        detail: {
          id:imageId,
          origin:`Événement : ${this.currentEvent?.title ?? this.currentEvent?.id ?? "inconnu"}`,
          snapshot:{ eventId:this.currentEvent?.id ?? null, eventTitle:this.currentEvent?.title ?? null, choiceId:choice.id ?? null, choiceLabel:choice.label ?? null }
        }
      }));
    }
  }

  createResolver() {
    const runtime = getGameRuntime();
    const { gameState, itemController, screenController } = runtime;
    return new EventResolver({
      gameState,
      itemController,
      async startEncounter(encounterId, encounterType) {
        gameState.setCurrentEncounter({ nodeId:gameState.currentNodeId, encounterId, type:encounterType });
        gameState.setStatus(GAME_STATUS.ENCOUNTER);
        screenController.showEncounter();
        const title = document.getElementById("encounter-title");
        if (title) title.textContent = "Rencontre imprévue";
        await runtime.encounterController.load(encounterId);
      }
    });
  }

  async resolveChoice(choice, effect = choice.effect, selection = {}) {
    const runtime = getGameRuntime();
    const { gameState, mapController, screenController, mapView } = runtime;
    if (!gameState || !mapController || !screenController) throw new Error("Le moteur de partie n’est pas disponible.");
    if (gameState.status !== GAME_STATUS.EVENT) throw new Error("Aucun événement n’est actuellement ouvert.");
    if (!this.eventNodeId || gameState.currentNodeId !== this.eventNodeId) throw new Error("La position de l’événement a changé pendant sa résolution.");

    const result = await this.createResolver().resolve(effect);
    if (effect.type === "start-encounter") return;

    await this.unlockGalleryRewards(choice);
    gameState.completeCurrentNode();
    gameState.setStatus(GAME_STATUS.MAP);
    screenController.showMap();
    mapView?.render({ gameState, currentNode:mapController.getCurrentNode(), accessibleNodes:mapController.getAccessibleNodes() });

    const status = document.getElementById("video-status");
    if (status) status.textContent = this.describeResult(result);
    window.dispatchEvent(new CustomEvent("chv1:event-completed", {
      detail:{
        nodeId:this.eventNodeId,
        eventId:this.currentEvent?.id ?? null,
        eventTitle:this.currentEvent?.title ?? null,
        choiceId:choice.id ?? null,
        choiceLabel:choice.label ?? null,
        galleryRewardIds:[...(choice.effect.galleryRewardIds ?? [])],
        ...selection,
        result
      }
    }));
  }

  getEventItemActions() {
    const runtime = getGameRuntime();
    const eventEngine = globalThis.__CHV1_PHASE_ONE__?.getEventEngine?.();
    if (!runtime.gameState || !eventEngine) throw new Error("Le moteur d’événements n’est pas disponible.");
    return new EventItemActions({ gameState:runtime.gameState, eventEngine });
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
      case "recharge-item": return result.itemId ? "L’objet choisi a été rechargé." : "Aucun objet compatible.";
      case "difficulty-shift": return "La difficulté de la prochaine rencontre a changé.";
      case "arm-protection": return "Une protection est active pour la prochaine rencontre.";
      case "next-duration": return "La durée de la prochaine rencontre a changé.";
      case "next-reward": return "La prochaine récompense a changé.";
      case "disable-item": return result.itemId ? "L’objet choisi est temporairement désactivé." : "Aucun objet compatible.";
      case "compound": return "Événement terminé. Plusieurs effets ont été appliqués.";
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
