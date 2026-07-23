"use strict";

import { getGameRuntime } from "../game/runtime-access.js";
import { EliteRewardService } from "../game/elite-reward-service.js";

export class RewardView {
  constructor({ rewardChoiceList, onRewardSelected }) {
    if (!(rewardChoiceList instanceof HTMLDivElement)) throw new Error("La liste des récompenses est invalide.");
    if (typeof onRewardSelected !== "function") throw new Error("onRewardSelected doit être une fonction.");
    this.rewardChoiceList = rewardChoiceList;
    this.onRewardSelected = onRewardSelected;
    this.currentBundle = null;
  }

  render({ goldAmount = 0 } = {}) {
    const runtime = getGameRuntime();
    const context = runtime.gameState?.consumeRunFlag?.("pending-elite-reward-context", null);
    const encounter = context?.encounter ?? { difficulty:2, rewardGold:goldAmount };
    const service = new EliteRewardService({ gameState:runtime.gameState, itemController:runtime.itemController });
    this.currentBundle = service.createBundle(encounter);
    this.rewardChoiceList.replaceChildren();

    const summary = document.createElement("p");
    summary.className = "reward-bundle-summary";
    summary.textContent = this.currentBundle.firstElite
      ? "Premier élite vaincu : au moins un objet est garanti."
      : `Deux récompenses — chance rare ${Math.round(this.currentBundle.rareChance * 100)} %.`;
    this.rewardChoiceList.append(summary);

    const grid = document.createElement("div");
    grid.className = "reward-bundle-grid";
    for (const reward of this.currentBundle.rewards) grid.append(this.createRewardCard(reward));
    this.rewardChoiceList.append(grid);

    const collectButton = document.createElement("button");
    collectButton.type = "button";
    collectButton.className = "reward-choice-button primary-button";
    collectButton.textContent = "Récupérer les deux récompenses";
    collectButton.addEventListener("click", () => {
      this.disableChoices();
      const applied = service.applyBundle(this.currentBundle, { applyGold:false });
      const gold = applied.filter((reward) => reward.type === "gold").reduce((sum, reward) => sum + reward.amount, 0);
      const items = applied.filter((reward) => reward.type === "item").map((reward) => reward.item?.name ?? reward.itemId);
      this.onRewardSelected({ type:"gold", amount:gold, bundleApplied:true, summary:{ gold, items } });
    });
    this.rewardChoiceList.append(collectButton);
  }

  createRewardCard(reward) {
    const card = document.createElement("article");
    card.className = "reward-choice-button reward-card";
    if (reward.type === "gold") {
      const title=document.createElement("strong"); title.textContent=`${reward.amount} or`;
      const detail=document.createElement("span"); detail.textContent="Récompense économique";
      card.append(title,detail); return card;
    }
    const rarity=reward.item?.rarity==="rare"?"Rare":reward.item?.rarity==="cursed"?"Maudit":"Commun";
    const title=document.createElement("strong"); title.textContent=reward.item?.name??reward.itemId;
    const description=document.createElement("span"); description.textContent=`${rarity} — ${reward.item?.description??"Objet obtenu"}`;
    card.append(title,description); return card;
  }

  disableChoices(){for(const button of this.rewardChoiceList.querySelectorAll("button"))button.disabled=true;}
  enableChoices(){for(const button of this.rewardChoiceList.querySelectorAll("button"))button.disabled=false;}
}