"use strict";

export class ScreenController {
  constructor({
    mapScreen,
    encounterScreen,
    eventScreen,
    rewardScreen,
    settingsPanel
  }) {
    this.mapScreen = mapScreen;
    this.encounterScreen = encounterScreen;
    this.eventScreen = eventScreen;
    this.rewardScreen = rewardScreen;
    this.settingsPanel = settingsPanel;

    this.validateElements();
  }

  validateElements() {
    const elements = [
      this.mapScreen,
      this.encounterScreen,
      this.eventScreen,
      this.rewardScreen,
      this.settingsPanel
    ];

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        throw new Error(
          "Un élément d’écran fourni est invalide."
        );
      }
    }
  }

  hideGameScreens() {
    this.mapScreen.hidden = true;
    this.encounterScreen.hidden = true;
    this.eventScreen.hidden = true;
    this.rewardScreen.hidden = true;
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