"use strict";

import { getItemById } from "../data/items.js";
import { getGameRuntime } from "../game/runtime-access.js";
import { EliteRewardService } from "../game/elite-reward-service.js";
import { createItemVisual } from "./item-visual.js";

const RARITY_LABELS = Object.freeze({ common: "Commun", rare: "Rare", cursed: "Maudit" });
const TYPE_LABELS = Object.freeze({ consumable: "Consommable", rechargeable: "Rechargeable", passive: "Passif" });

function ensureRewardStylesheet() {
  if (document.querySelector('link[data-elite-reward-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./elite-reward.css";
  link.dataset.eliteRewardStyles = "true";
  document.head.append(link);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export class RewardView {
  constructor({ rewardChoiceList, onRewardSelected }) {
    if (!(rewardChoiceList instanceof HTMLDivElement)) throw new Error("La liste des récompenses est invalide.");
    if (typeof onRewardSelected !== "function") throw new Error("onRewardSelected doit être une fonction.");
    ensureRewardStylesheet();
    Object.assign(this, { rewardChoiceList, onRewardSelected });
    this.currentRound = 0;
    this.reservedItemIds = [];
    this.service = null;
    this.encounter = null;
  }

  render({ goldAmount = 0 } = {}) {
    const runtime = getGameRuntime();
    const context = runtime.gameState?.consumeRunFlag?.("pending-elite-reward-context", null);
    this.encounter = context?.encounter ?? { difficulty: 2, rewardGold: goldAmount };
    this.service = new EliteRewardService({ gameState: runtime.gameState, itemController: runtime.itemController });
    this.currentRound = 1;
    this.reservedItemIds = [];
    this.renderRound();
  }

  renderRound() {
    const options = this.service.createRoundOptions(this.encounter, this.reservedItemIds);
    if (options.item && !this.reservedItemIds.includes(options.item.itemId)) this.reservedItemIds.push(options.item.itemId);
    this.rewardChoiceList.replaceChildren();
    this.rewardChoiceList.classList.add("elite-reward-choice-list");

    const progress = createElement("section", "elite-reward-progress");
    const progressHeading = createElement("div", "elite-reward-progress__heading");
    progressHeading.append(
      createElement("strong", "elite-reward-progress__title", `Récompense ${this.currentRound} sur 2`),
      createElement("span", "elite-reward-progress__hint", "Choisis une seule récompense")
    );
    const track = createElement("div", "elite-reward-progress__track");
    const fill = createElement("span", "elite-reward-progress__fill");
    fill.style.width = `${this.currentRound * 50}%`;
    track.append(fill);
    const steps = createElement("div", "elite-reward-progress__steps");
    for (let index = 1; index <= 2; index += 1) {
      const step = createElement("span", `elite-reward-step${index <= this.currentRound ? " is-active" : ""}`, String(index));
      steps.append(step);
    }
    progress.append(progressHeading, track, steps);

    const chance = createElement("p", "elite-reward-rare-chance", `Chance d’obtenir un objet rare : ${Math.round(options.rareChance * 100)} %`);
    const grid = createElement("div", "reward-bundle-grid elite-reward-grid");
    grid.append(this.createRewardButton(options.gold));
    if (options.item) {
      grid.append(this.createRewardButton(options.item));
    } else {
      const empty = createElement("article", "reward-card elite-reward-card is-empty");
      empty.append(
        createElement("span", "elite-reward-card__emblem", "∅"),
        createElement("strong", "elite-reward-card__title", "Aucun nouvel objet"),
        createElement("p", "elite-reward-card__description", "Tous les objets disponibles pour cette récompense sont déjà réservés ou possédés.")
      );
      grid.append(empty);
    }
    this.rewardChoiceList.append(progress, chance, grid);
  }

  createRewardButton(reward) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reward-choice-button reward-card elite-reward-card";

    if (reward.type === "gold") {
      button.classList.add("elite-reward-card--gold");
      const coins = createElement("div", "elite-reward-coins");
      coins.setAttribute("aria-hidden", "true");
      for (let index = 0; index < 7; index += 1) coins.append(createElement("span", "elite-reward-coin", "●"));
      button.append(
        createElement("span", "elite-reward-card__badge", "Or"),
        coins,
        createElement("strong", "elite-reward-card__amount", `${reward.amount} or`),
        createElement("p", "elite-reward-card__description", "Ajouté immédiatement à tes ressources."),
        createElement("span", "elite-reward-card__action", "Prendre l’or")
      );
    } else {
      const item = reward.item;
      const rarity = item?.rarity ?? "common";
      const type = item?.type ?? "unknown";
      const runtime = getGameRuntime();
      const inventory = runtime.gameState?.inventory ?? [];
      const ownedSameType = inventory
        .map((itemId) => getItemById(itemId))
        .filter((ownedItem) => ownedItem?.type === type).length;

      button.classList.add("elite-reward-card--item", `elite-reward-card--${rarity}`);
      const header = createElement("div", "elite-reward-card__header");
      header.append(
        createElement("span", `elite-reward-rarity elite-reward-rarity--${rarity}`, RARITY_LABELS[rarity] ?? rarity),
        createElement("span", "elite-reward-new-badge", "Nouvel objet")
      );
      const visual = createItemVisual(item ?? { id: reward.itemId });
      visual.classList.add("elite-reward-item-visual");
      const comparison = createElement("div", "elite-reward-comparison");
      comparison.append(
        createElement("span", "elite-reward-comparison__label", TYPE_LABELS[type] ?? type),
        createElement("span", "elite-reward-comparison__value", `${ownedSameType} déjà possédé${ownedSameType > 1 ? "s" : ""} de ce type`)
      );
      button.append(
        header,
        visual,
        createElement("strong", "elite-reward-card__title", item?.name ?? reward.itemId),
        createElement("p", "elite-reward-card__description", item?.description ?? "Objet obtenu"),
        comparison,
        createElement("span", "elite-reward-card__action", "Prendre l’objet")
      );
    }

    button.addEventListener("click", () => this.selectReward(reward));
    return button;
  }

  selectReward(reward) {
    this.disableChoices();
    const applied = this.service.applyReward(reward);
    if (!applied) {
      this.enableChoices();
      return;
    }
    if (this.currentRound < 2) {
      this.currentRound += 1;
      this.renderRound();
      return;
    }
    this.service.completeElite();
    this.onRewardSelected({ type: "gold", amount: 0, eliteRewardComplete: true });
  }

  disableChoices() {
    for (const button of this.rewardChoiceList.querySelectorAll("button")) button.disabled = true;
  }

  enableChoices() {
    for (const button of this.rewardChoiceList.querySelectorAll("button")) button.disabled = false;
  }
}
