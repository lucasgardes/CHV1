"use strict";

export class ScreenController {
  constructor({
    mapScreen,
    encounterScreen,
    eventScreen,
    rewardScreen,
    shopScreen = document.querySelector("#shop-screen"),
    campfireScreen = document.querySelector("#campfire-screen"),
    settingsPanel
  }) {
    this.mapScreen = mapScreen;
    this.encounterScreen = encounterScreen;
    this.eventScreen = eventScreen;
    this.rewardScreen = rewardScreen;
    this.shopScreen = shopScreen;
    this.campfireScreen = campfireScreen;
    this.settingsPanel = settingsPanel;

    this.validateElements();
  }

  validateElements() {
    const requiredElements = [
      this.mapScreen,
      this.encounterScreen,
      this.eventScreen,
      this.rewardScreen,
      this.settingsPanel
    ];

    for (const element of requiredElements) {
      if (!(element instanceof HTMLElement)) {
        throw new Error(
          "Un élément d’écran fourni est invalide."
        );
      }
    }

    for (const optionalScreen of [this.shopScreen, this.campfireScreen]) {
      if (optionalScreen !== null && !(optionalScreen instanceof HTMLElement)) {
        throw new Error("Un écran de salle optionnel est invalide.");
      }
    }
  }

  hideGameScreens() {
    this.mapScreen.hidden = true;
    this.encounterScreen.hidden = true;
    this.eventScreen.hidden = true;
    this.rewardScreen.hidden = true;

    if (this.shopScreen) {
      this.shopScreen.hidden = true;
    }

    if (this.campfireScreen) {
      this.campfireScreen.hidden = true;
    }
  }

  showMap() {
    this.hideGameScreens();
    this.mapScreen.hidden = false;
  }

  showEncounter() {
    this.hideGameScreens();
    this.encounterScreen.hidden = false;
  }

  showEvent() {
    this.hideGameScreens();
    this.eventScreen.hidden = false;
  }

  showReward() {
    this.hideGameScreens();
    this.rewardScreen.hidden = false;
  }

  showShop() {
    if (!this.shopScreen) {
      throw new Error("L’écran de boutique est indisponible.");
    }

    this.hideGameScreens();
    this.shopScreen.hidden = false;
  }

  showCampfire() {
    if (!this.campfireScreen) {
      throw new Error("L’écran de feu de camp est indisponible.");
    }

    this.hideGameScreens();
    this.campfireScreen.hidden = false;
  }

  openSettings() {
    this.settingsPanel.hidden = false;
  }

  closeSettings() {
    this.settingsPanel.hidden = true;
  }

  isSettingsOpen() {
    return !this.settingsPanel.hidden;
  }
}
