"use strict";

function initializeEncounterVolume() {
  const stage = document.querySelector("#encounter-screen .encounter-stage");
  const video = document.getElementById("round-video");
  if (!(stage instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) return;
  if (stage.querySelector(".encounter-volume-control")) return;

  const control = document.createElement("label");
  control.className = "encounter-volume-control";
  control.setAttribute("aria-label", "Volume de la vidéo");

  const icon = document.createElement("span");
  icon.className = "encounter-volume-control__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "🔊";

  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.05";
  input.value = String(video.volume);
  input.setAttribute("aria-label", "Volume");

  const updateIcon = () => {
    icon.textContent = video.muted || video.volume === 0 ? "🔇" : video.volume < 0.5 ? "🔉" : "🔊";
  };

  input.addEventListener("input", () => {
    video.muted = false;
    video.volume = Number(input.value);
    updateIcon();
  });

  icon.addEventListener("click", () => {
    video.muted = !video.muted;
    updateIcon();
  });

  control.append(icon, input);
  stage.append(control);
  updateIcon();
}

window.addEventListener("DOMContentLoaded", initializeEncounterVolume);
