"use strict";

import {
  clamp
} from "./funscript.js";

import {
  VIDEO_CONFIG
} from "./config.js";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export class VideoPlayerController {
  constructor({
    video,
    playButton,
    backwardButton,
    forwardButton,
    restartButton,
    statusElement,
    currentTimeElement,
    durationElement,
    seekStepSeconds = VIDEO_CONFIG.seekStepSeconds,
    onFrame = () => {},
    onPlay = async () => {},
    onPause = async () => {},
    onSeeking = async () => {},
    onSeeked = async () => {},
    onEnded = async () => {},
    onError = () => {}
  }) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("Le lecteur vidéo fourni est invalide.");
    }

    const buttons = [
      playButton,
      backwardButton,
      forwardButton,
      restartButton
    ];

    if (
      buttons.some(
        (button) => !(button instanceof HTMLButtonElement)
      )
    ) {
      throw new Error(
        "Un ou plusieurs boutons vidéo sont invalides."
      );
    }

    if (!(statusElement instanceof HTMLElement)) {
      throw new Error("Le statut vidéo est invalide.");
    }

    if (!(currentTimeElement instanceof HTMLElement)) {
      throw new Error(
        "L'affichage du temps courant est invalide."
      );
    }

    if (!(durationElement instanceof HTMLElement)) {
      throw new Error(
        "L'affichage de la durée est invalide."
      );
    }

    this.video = video;
    this.playButton = playButton;
    this.backwardButton = backwardButton;
    this.forwardButton = forwardButton;
    this.restartButton = restartButton;

    this.statusElement = statusElement;
    this.currentTimeElement = currentTimeElement;
    this.durationElement = durationElement;

    this.seekStepSeconds = seekStepSeconds;

    this.onFrame = onFrame;
    this.onPlay = onPlay;
    this.onPause = onPause;
    this.onSeeking = onSeeking;
    this.onSeeked = onSeeked;
    this.onEnded = onEnded;
    this.onError = onError;

    this.animationFrameId = null;

    this.registerEvents();
    this.updatePlayButton();
    this.updateTimeDisplay();
  }

  updatePlayButton() {
    this.playButton.textContent =
      this.video.paused ? "Lecture" : "Pause";
  }

  updateTimeDisplay() {
    this.currentTimeElement.textContent =
      formatTime(this.video.currentTime);

    this.durationElement.textContent =
      formatTime(this.video.duration);
  }

  runFrameLoop() {
    this.onFrame();

    if (!this.video.paused && !this.video.ended) {
      this.animationFrameId = requestAnimationFrame(
        () => this.runFrameLoop()
      );
    } else {
      this.animationFrameId = null;
    }
  }

  startFrameLoop() {
    this.stopFrameLoop();

    this.animationFrameId = requestAnimationFrame(
      () => this.runFrameLoop()
    );
  }

  stopFrameLoop() {
    if (this.animationFrameId === null) {
      return;
    }

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  async togglePlayback() {
    try {
      if (this.video.paused || this.video.ended) {
        await this.video.play();
      } else {
        this.video.pause();
      }
    } catch (error) {
      console.error(
        "Impossible de lancer la vidéo :",
        error
      );

      this.statusElement.textContent =
        "Erreur de lecture";

      this.onError(error);
    }
  }

  seekBy(seconds) {
    if (!Number.isFinite(this.video.duration)) {
      return;
    }

    const newTime = this.video.currentTime + seconds;

    this.video.currentTime = clamp(
      newTime,
      0,
      this.video.duration
    );
  }

  async restart() {
    this.video.pause();

    try {
      await this.onPause({
        reason: "restart",
        freezeAtCurrentPosition: false
      });

      this.video.currentTime = 0;
      this.onFrame();

      await this.video.play();
    } catch (error) {
      console.error(
        "Impossible de relancer la vidéo :",
        error
      );

      this.statusElement.textContent =
        "Erreur de lecture";

      this.onError(error);
    }
  }

  registerEvents() {
    this.playButton.addEventListener(
      "click",
      () => void this.togglePlayback()
    );

    this.backwardButton.addEventListener(
      "click",
      () => this.seekBy(-this.seekStepSeconds)
    );

    this.forwardButton.addEventListener(
      "click",
      () => this.seekBy(this.seekStepSeconds)
    );

    this.restartButton.addEventListener(
      "click",
      () => void this.restart()
    );

    this.video.addEventListener(
      "loadedmetadata",
      () => {
        this.statusElement.textContent =
          "Vidéo chargée";

        this.updateTimeDisplay();
        this.onFrame();
      }
    );

    this.video.addEventListener(
      "play",
      async () => {
        this.statusElement.textContent =
          "Lecture en cours";

        this.updatePlayButton();
        this.startFrameLoop();

        await this.onPlay();
      }
    );

    this.video.addEventListener(
      "pause",
      async () => {
        if (!this.video.ended) {
          this.statusElement.textContent =
            "Vidéo en pause";
        }

        this.updatePlayButton();
        this.stopFrameLoop();
        this.onFrame();

        await this.onPause({
          reason: "pause",
          freezeAtCurrentPosition: true
        });
      }
    );

    this.video.addEventListener(
      "timeupdate",
      () => {
        this.updateTimeDisplay();
      }
    );

    this.video.addEventListener(
      "seeking",
      async () => {
        this.onFrame();

        await this.onSeeking({
          freezeAtCurrentPosition: true
        });
      }
    );

    this.video.addEventListener(
      "seeked",
      async () => {
        this.updateTimeDisplay();
        this.onFrame();

        console.log(
          `Nouvelle position : ` +
          `${this.video.currentTime} secondes`
        );

        await this.onSeeked();
      }
    );

    this.video.addEventListener(
      "ended",
      async () => {
        this.statusElement.textContent =
          "Round terminé";

        this.updatePlayButton();
        this.stopFrameLoop();
        this.onFrame();

        await this.onEnded();

        console.log("La vidéo est terminée.");
      }
    );

    this.video.addEventListener(
      "error",
      () => {
        this.statusElement.textContent =
          "Impossible de charger la vidéo";

        const mediaError = this.video.error;

        if (mediaError !== null) {
          console.error(
            "Erreur vidéo :",
            mediaError.code,
            mediaError.message
          );
        }

        this.onError(mediaError);
      }
    );
  }
}
