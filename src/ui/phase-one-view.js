"use strict";

const ENDING_COPY = Object.freeze({
  "subject-perfect": {
    kicker: "Protocole terminé",
    title: "Le sujet parfait",
    body: "Le boss est vaincu, mais aucune sortie ne s’ouvre. L’entreprise a enfin trouvé le cobaye qu’elle recherchait."
  },
  escape: {
    kicker: "Protocole brisé",
    title: "L’évasion",
    body: "Le dispositif secret neutralise le verrouillage du complexe. Pour la première fois, une porte mène réellement vers l’extérieur."
  }
});

export class PhaseOneView {
  constructor({ screen, kicker, title, message, primaryButton, secondaryButton }) {
    this.screen = screen;
    this.kicker = kicker;
    this.title = title;
    this.message = message;
    this.primaryButton = primaryButton;
    this.secondaryButton = secondaryButton;
  }

  hideAllGameScreens() {
    for (const element of document.querySelectorAll(".game-screen")) element.hidden = true;
  }

  show({ kicker, title, message, primaryLabel, onPrimary, secondaryLabel = "", onSecondary = null }) {
    this.hideAllGameScreens();
    this.kicker.textContent = kicker;
    this.title.textContent = title;
    this.message.textContent = message;
    this.primaryButton.textContent = primaryLabel;
    this.primaryButton.onclick = onPrimary;
    this.secondaryButton.hidden = !secondaryLabel;
    this.secondaryButton.textContent = secondaryLabel;
    this.secondaryButton.onclick = onSecondary;
    this.screen.hidden = false;
  }

  showWhiteSpace({ loopCount, message, onContinue }) {
    this.show({
      kicker: `Boucle ${String(loopCount).padStart(3, "0")}`,
      title: "L’espace blanc",
      message,
      primaryLabel: "Se réveiller",
      onPrimary: onContinue
    });
  }

  showEnding({ ending, onRestart }) {
    const copy = ENDING_COPY[ending] ?? ENDING_COPY["subject-perfect"];
    this.show({
      kicker: copy.kicker,
      title: copy.title,
      message: copy.body,
      primaryLabel: "Recommencer une partie",
      onPrimary: onRestart
    });
  }
}
