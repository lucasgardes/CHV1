"use strict";

export class RewardView {
  constructor({
    rewardChoiceList,
    onRewardSelected
  }) {
    if (!(rewardChoiceList instanceof HTMLDivElement)) {
      throw new Error(
        "La liste des récompenses est invalide."
      );
    }

    if (typeof onRewardSelected !== "function") {
      throw new Error(
        "onRewardSelected doit être une fonction."
      );
    }

    this.rewardChoiceList =
      rewardChoiceList;

    this.onRewardSelected =
      onRewardSelected;
  }

  render({
    goldAmount,
    item
  }) {
    this.rewardChoiceList.replaceChildren();

    this.renderGoldReward(goldAmount);

    if (item !== null) {
      this.renderItemReward(item);
    }
  }

  renderGoldReward(goldAmount) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "reward-choice-button";

    button.textContent =
      `${goldAmount} or`;

    button.addEventListener(
      "click",
      () => {
        this.disableChoices();

        this.onRewardSelected({
          type: "gold",
          amount: goldAmount
        });
      }
    );

    this.rewardChoiceList.append(button);
  }

  renderItemReward(item) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "reward-choice-button";

    button.textContent =
      item.name;

    button.title =
      item.description;

    button.addEventListener(
      "click",
      () => {
        this.disableChoices();

        this.onRewardSelected({
          type: "item",
          itemId: item.id
        });
      }
    );

    this.rewardChoiceList.append(button);
  }

  disableChoices() {
    for (
      const button of
      this.rewardChoiceList.querySelectorAll("button")
    ) {
      button.disabled = true;
    }
  }

  enableChoices() {
    for (
      const button of
      this.rewardChoiceList.querySelectorAll("button")
    ) {
      button.disabled = false;
    }
  }
}