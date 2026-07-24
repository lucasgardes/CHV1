"use strict";

import { getAvailableItems, getItemById } from "../data/items.js";
import { getGameRuntime } from "../game/runtime-access.js";
import { EventResolver } from "../game/event-resolver.js";
import { EventItemActions } from "../game/event-item-actions.js";
import { GAME_STATUS } from "../game/game-state.js";

function replaceVariables(value, variables = {}) {
  if (Array.isArray(value)) return value.map((entry) => replaceVariables(entry, variables));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && Object.hasOwn(variables, value) ? variables[value] : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceVariables(entry, variables)]));
}

function formatSeconds(value) {
  const seconds = Math.abs(Math.round(Number(value) || 0));
  if (seconds < 60) return `${seconds} seconde${seconds > 1 ? "s" : ""}`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} min ${remainder} s` : `${minutes} minute${minutes > 1 ? "s" : ""}`;
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
    this.exchangeProposals = new Map();
    this.nestedContexts = new Map();
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

  getOwnedCandidates(effect = {}) {
    const { gameState } = getGameRuntime();
    return (gameState?.inventory ?? [])
      .map((itemId) => getItemById(itemId))
      .filter((item) => item && (!effect.itemType || item.type === effect.itemType));
  }

  getExchangeProposals(choice) {
    if (this.exchangeProposals.has(choice.id)) return this.exchangeProposals.get(choice.id);
    const inventory = getGameRuntime().gameState?.inventory ?? [];
    const pool = getAvailableItems(inventory).filter((item) => !choice.effect.itemType || item.type === choice.effect.itemType);
    const selected = [];
    while (pool.length && selected.length < (choice.effect.count ?? 2)) {
      selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    this.exchangeProposals.set(choice.id, selected);
    return selected;
  }

  getNestedContext(choice) {
    if (this.nestedContexts.has(choice.id)) return this.nestedContexts.get(choice.id);
    const setup = choice.effect?.setup ?? {};
    let context = {};
    if (setup.type === "random-owned-item") {
      const candidates = this.getOwnedCandidates(setup);
      const item = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
      context = { itemId: item?.id ?? null, itemName: item?.name ?? null, itemType: item?.type ?? null };
    }
    this.nestedContexts.set(choice.id, context);
    return context;
  }

  appendChoice(event, choice) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button";
    button.textContent = choice.label;
    const type = choice.effect?.type;
    if (type === "choose-owned-item" && this.getOwnedCandidates(choice.effect).length === 0) {
      button.disabled = true;
      button.title = choice.effect.unavailableLabel || "Aucun objet compatible.";
    }
    if (type === "choose-item-exchange" && (!this.getOwnedCandidates(choice.effect).length || !this.getExchangeProposals(choice).length)) {
      button.disabled = true;
      button.title = choice.effect.unavailableLabel || "Échange impossible.";
    }
    button.addEventListener("click", async () => {
      if (this.resolving) return;
      if (type === "choose-owned-item") return this.showOwnedItemSelection(choice);
      if (type === "choose-item-exchange") return this.showExchangeProposalSelection(choice);
      if (type === "nested-choice") return this.showNestedChoice(choice);
      this.resolving = true;
      this.disableChoices();
      try {
        await this.resolveChoice(choice, choice.effect);
      } catch (error) {
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
        const variables = { "$selectedItemId": item.id, "$selectedItemName": item.name };
        const effects = [choice.effect.selectedEffect, ...(choice.effect.afterEffects || [])]
          .filter(Boolean)
          .map((effect) => replaceVariables(effect, variables));
        const resolvedEffect = effects.length === 1 ? effects[0] : { type: "compound", effects };
        try {
          await this.resolveChoice(choice, resolvedEffect, { selectedItemId: item.id, selectedItemName: item.name });
        } catch (error) {
          this.resolving = false;
          console.error("Impossible d’appliquer le choix d’objet :", error);
          this.render(this.currentEvent);
        }
      });
      this.eventChoiceList.append(button);
    }
    this.appendBackButton();
  }

  showExchangeProposalSelection(choice) {
    const proposals = this.getExchangeProposals(choice);
    if (!proposals.length) return;
    this.eventTitle.textContent = choice.effect.proposalTitle || "Choisir le nouvel objet";
    this.eventDescription.textContent = choice.effect.proposalPrompt || "Choisis l’une des deux propositions.";
    this.eventChoiceList.replaceChildren();
    for (const item of proposals) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = item.name;
      button.addEventListener("click", () => this.showExchangeOwnedSelection(choice, item));
      this.eventChoiceList.append(button);
    }
    this.appendBackButton();
  }

  showExchangeOwnedSelection(choice, receiveItem) {
    const owned = this.getOwnedCandidates(choice.effect);
    this.eventTitle.textContent = choice.effect.giveTitle || "Choisir l’objet à abandonner";
    this.eventDescription.textContent = `Tu recevras « ${receiveItem.name} ». Choisis maintenant l’objet que tu cèdes.`;
    this.eventChoiceList.replaceChildren();
    for (const giveItem of owned) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = giveItem.name;
      button.addEventListener("click", async () => {
        if (this.resolving) return;
        this.resolving = true;
        this.disableChoices();
        try {
          await this.resolveChoice(
            choice,
            { type: "exchange-item", giveItemId: giveItem.id, receiveItemId: receiveItem.id },
            { givenItemId: giveItem.id, givenItemName: giveItem.name, receivedItemId: receiveItem.id, receivedItemName: receiveItem.name }
          );
        } catch (error) {
          this.resolving = false;
          console.error("Impossible d’échanger les objets :", error);
          this.render(this.currentEvent);
        }
      });
      this.eventChoiceList.append(button);
    }
    const back = document.createElement("button");
    back.type = "button";
    back.className = "event-choice-button secondary-button";
    back.textContent = "Retour aux propositions";
    back.addEventListener("click", () => this.showExchangeProposalSelection(choice));
    this.eventChoiceList.append(back);
  }

  showNestedChoice(choice) {
    const context = this.getNestedContext(choice);
    const variables = { "$contextItemId": context.itemId, "$contextItemName": context.itemName };
    this.eventTitle.textContent = choice.effect.title || this.currentEvent.title;
    this.eventDescription.textContent = context.itemId
      ? (choice.effect.prompt || "Une nouvelle décision est nécessaire.").replaceAll("$contextItemName", context.itemName)
      : (choice.effect.emptyPrompt || "Aucun objet compatible n’a été trouvé.");
    this.eventChoiceList.replaceChildren();
    if (!context.itemId) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = choice.effect.emptyLabel || "Continuer";
      button.addEventListener("click", () => void this.resolveChoice(choice, { type: "none" }, { nestedContext: context }));
      this.eventChoiceList.append(button);
      return;
    }
    for (const nested of choice.effect.choices ?? []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = String(nested.label || "Choisir").replaceAll("$contextItemName", context.itemName);
      const gameState = getGameRuntime().gameState;
      if (nested.requiresGold && Number(gameState?.gold || 0) < nested.requiresGold) {
        button.disabled = true;
        button.title = `Il faut ${nested.requiresGold} pièces d’or.`;
      }
      button.addEventListener("click", async () => {
        if (this.resolving) return;
        this.resolving = true;
        this.disableChoices();
        try {
          await this.resolveChoice(choice, replaceVariables(nested.effect, variables), {
            nestedChoiceId: nested.id,
            nestedChoiceLabel: nested.label,
            contextItemId: context.itemId,
            contextItemName: context.itemName
          });
        } catch (error) {
          this.resolving = false;
          console.error("Impossible d’appliquer le choix imbriqué :", error);
          this.showNestedChoice(choice);
        }
      });
      this.eventChoiceList.append(button);
    }
    this.appendBackButton();
  }

  appendBackButton() {
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

  createResolver() {
    const runtime = getGameRuntime();
    const { gameState, itemController, mapController, screenController } = runtime;
    return new EventResolver({
      gameState,
      itemController,
      mapController,
      async startEncounter(encounterId, encounterType) {
        gameState.setCurrentEncounter({ nodeId: gameState.currentNodeId, encounterId, type: encounterType });
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
    const { gameState } = runtime;
    if (!gameState || !runtime.mapController || !runtime.screenController) throw new Error("Le moteur de partie n’est pas disponible.");
    if (gameState.status !== GAME_STATUS.EVENT) throw new Error("Aucun événement n’est actuellement ouvert.");
    if (!this.eventNodeId || gameState.currentNodeId !== this.eventNodeId) throw new Error("La position de l’événement a changé pendant sa résolution.");

    const result = await this.createResolver().resolve(effect);
    if (effect.type === "start-encounter") return;
    if (effect.type === "exchange-item" && !result.receivedItemId) throw new Error("L’échange n’a pas pu être appliqué.");

    await this.unlockGalleryRewards(choice);
    this.showResolutionResult({ choice, result, selection });
  }

  showResolutionResult({ choice, result, selection }) {
    this.resolving = true;
    this.eventTitle.textContent = "Résultat";
    this.eventDescription.textContent = this.describeResult(result);
    this.eventChoiceList.replaceChildren();

    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "event-choice-button";
    continueButton.textContent = "Continuer vers la carte";
    continueButton.addEventListener("click", () => this.finishEvent(choice, result, selection));
    this.eventChoiceList.append(continueButton);
  }

  finishEvent(choice, result, selection = {}) {
    const runtime = getGameRuntime();
    const { gameState, mapController, screenController, mapView } = runtime;
    if (!gameState || gameState.status !== GAME_STATUS.EVENT) return;

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
        ...selection,
        result
      }
    }));
  }

  describeResult(result) {
    const messages = this.collectResultMessages(result);
    return messages.length ? messages.join("\n") : "Événement terminé sans conséquence.";
  }

  collectResultMessages(result) {
    if (!result) return ["Aucune conséquence n’a été appliquée."];
    if (result.type === "compound") return (result.results ?? []).flatMap((entry) => this.collectResultMessages(entry));
    if (result.type === "random-outcome") return this.collectResultMessages(result.result);

    switch (result.type) {
      case "gain-gold": {
        const extra = Number(result.blessingGold) > 0 ? `, dont ${result.blessingGold} grâce à la bénédiction` : "";
        return [`Gain : ${result.amount} pièces d’or${extra}.`];
      }
      case "lose-gold": return [`Perte : ${result.amount} pièces d’or.`];
      case "gain-item": {
        const item = getItemById(result.itemId);
        return [result.itemId ? `Objet obtenu : ${item?.name ?? result.itemId}.` : "Aucun objet disponible n’a pu être obtenu."];
      }
      case "lose-item": {
        const item = getItemById(result.itemId);
        return [result.itemId ? `Objet perdu : ${item?.name ?? result.itemId}.` : "Aucun objet compatible n’a été perdu."];
      }
      case "exchange-item": {
        const given = getItemById(result.givenItemId)?.name ?? result.givenItemId;
        const received = getItemById(result.receivedItemId)?.name ?? result.receivedItemId;
        return result.receivedItemId ? [`Échange effectué : ${given} contre ${received}.`] : ["L’échange n’a pas pu être effectué."];
      }
      case "three-lockers-security": {
        if (result.mode === "fallback-consumable") {
          const item = getItemById(result.itemId);
          return [result.itemId ? `Aucun rechargeable possédé : ${item?.name ?? result.itemId} a été obtenu à la place.` : "Aucun objet de remplacement n’était disponible."];
        }
        return [`Recharge réduite d’un round pour ${result.itemIds?.length ?? 0} objet(s) rechargeable(s).`];
      }
      case "reveal-next-encounters": {
        const details = (result.encounters ?? []).map((encounter) => {
          const difficulty = encounter.difficulty ?? "inconnue";
          const duration = formatSeconds(encounter.durationSeconds);
          return `${encounter.title ?? "Rencontre"} : difficulté ${difficulty}, durée ${duration}.`;
        });
        return result.encounters?.length
          ? [result.observation || "Des informations ont été révélées.", ...details]
          : ["Aucune prochaine rencontre n’a pu être révélée."];
      }
      case "recharge-item": {
        const item = getItemById(result.itemId);
        return [result.itemId ? `Objet rechargé : ${item?.name ?? result.itemId}.` : "Aucun objet rechargeable compatible."];
      }
      case "reduce-recharge-all": return [`Recharge réduite d’un round pour ${result.itemIds?.length ?? 0} objet(s).`];
      case "difficulty-shift": return [`La difficulté de la prochaine rencontre est modifiée de ${result.amount > 0 ? "+" : ""}${result.amount}.`];
      case "arm-protection": return ["Une protection est active pour la prochaine rencontre."];
      case "next-duration": {
        const seconds = Number(result.modifier?.durationSeconds) || 0;
        return [`La prochaine rencontre sera ${seconds < 0 ? "raccourcie" : "allongée"} de ${formatSeconds(seconds)}.`];
      }
      case "next-reward": {
        const flat = Number(result.modifier?.rewardGoldFlat) || 0;
        const multiplier = Number(result.modifier?.rewardMultiplier) || 1;
        const parts = [];
        if (flat) parts.push(`${flat > 0 ? "+" : ""}${flat} or`);
        if (multiplier !== 1) parts.push(`multiplicateur ×${multiplier}`);
        return [`Récompense de la prochaine rencontre modifiée${parts.length ? ` : ${parts.join(", ")}` : ""}.`];
      }
      case "next-intensity": return [`L’intensité de la prochaine rencontre est modifiée de ${result.modifier?.intensityShift > 0 ? "+" : ""}${result.modifier?.intensityShift ?? 0}.`];
      case "hide-interface": return [`La prochaine rencontre commencera sans interface pendant ${formatSeconds(result.modifier?.hideInterfaceSeconds)}.`];
      case "shop-price-multiplier": return [`Les prix de la prochaine boutique seront multipliés par ${result.multiplier}.`];
      case "elite-rare-bonus": return [`La prochaine récompense d’élite gagne ${Math.round((Number(result.amount) || 0) * 100)} % de chance rare supplémentaire.`];
      case "disable-item": {
        const item = getItemById(result.itemId);
        return [result.itemId ? `${item?.name ?? result.itemId} est désactivé pendant ${result.encounters} rencontre(s).` : "Aucun objet compatible n’a été désactivé."];
      }
      case "disable-random-item-with-deferred-reward": {
        const item = getItemById(result.itemId);
        if (!result.itemId) return ["Aucun objet rechargeable n’a été désactivé et aucune compensation n’a été programmée."];
        return [
          `${item?.name ?? result.itemId} est désactivé pendant ${result.disableEncounters} rencontre(s).`,
          `Compensation différée : ${result.reward?.gold ?? 0} or après ${result.reward?.encountersRemaining ?? 0} rencontre(s) réussie(s).`
        ];
      }
      case "queue-deferred-reward": return [`Récompense différée : ${result.reward?.gold ?? 0} or après ${result.reward?.encountersRemaining ?? 0} rencontre(s) réussie(s).`];
      case "none": return ["Aucune conséquence."];
      default: return ["Les conséquences du choix ont été appliquées."];
    }
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
    if (!candidates.length) {
      this.resolving = false;
      this.enableChoices();
      return;
    }
    if (candidates.length === 1) {
      actions.commitReroll(candidates[0].id);
      this.render(candidates[0]);
      return;
    }
    this.eventTitle.textContent = "Pièce truquée";
    this.eventDescription.textContent = "Choisis le résultat que tu souhaites conserver.";
    this.eventChoiceList.replaceChildren();
    this.resolving = false;
    for (const candidate of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-choice-button";
      button.textContent = candidate.title;
      button.addEventListener("click", () => {
        actions.commitReroll(candidate.id);
        this.render(candidate);
      });
      this.eventChoiceList.append(button);
    }
  }

  async useBlankContract(event) {
    const replaced = this.getEventItemActions().useBlankContract(event);
    if (!replaced) {
      this.resolving = false;
      this.enableChoices();
      return;
    }
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
      try {
        await action();
      } catch (error) {
        this.resolving = false;
        console.error(`Impossible d’exécuter « ${label} » :`, error);
        this.enableChoices();
      }
    });
    this.eventChoiceList.append(button);
  }

  disableChoices() {
    for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = true;
  }

  enableChoices() {
    for (const button of this.eventChoiceList.querySelectorAll("button")) button.disabled = false;
  }
}
