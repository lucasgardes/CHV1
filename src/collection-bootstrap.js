"use strict";

const state = {
  catalog: { videos: [], images: [] },
  collection: { videos: {}, images: {} },
  kind: "video",
  query: "",
  performer: "",
  theme: "",
  unlockState: "all",
  activeMedia: null,
  playerWasPlaying: false
};

const byId = (id) => document.getElementById(id);
const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

function isVideoDiscovered(media) {
  return Boolean(state.collection.videos?.[media.id]?.discovered || state.collection.videos?.[media.id]?.completed);
}
function isVideoCompleted(media) { return Boolean(state.collection.videos?.[media.id]?.completed); }
function isImageUnlocked(media) { return Boolean(state.collection.images?.[media.id]?.unlocked); }
function isRevealed(media) { return media.kind === "video" ? isVideoDiscovered(media) : isImageUnlocked(media); }

function matchesUnlockState(media) {
  if (state.unlockState === "all") return true;
  if (media.kind === "image") {
    if (state.unlockState === "undiscovered") return !isImageUnlocked(media);
    if (state.unlockState === "discovered" || state.unlockState === "completed") return isImageUnlocked(media);
    if (state.unlockState === "unfinished") return false;
  }
  if (state.unlockState === "undiscovered") return !isVideoDiscovered(media);
  if (state.unlockState === "discovered") return isVideoDiscovered(media);
  if (state.unlockState === "completed") return isVideoCompleted(media);
  if (state.unlockState === "unfinished") return isVideoDiscovered(media) && !isVideoCompleted(media);
  return true;
}

function getFilteredMedia() {
  const source = state.kind === "video" ? state.catalog.videos : state.catalog.images;
  return source.filter((media) => {
    if (!media.enabled) return false;
    const revealed = isRevealed(media);
    if (state.performer && !media.performers.includes(state.performer)) return false;
    if (state.theme && !media.themes.includes(state.theme)) return false;
    if (!matchesUnlockState(media)) return false;
    if (state.query) {
      if (!revealed) return false;
      const haystack = [media.title, ...media.performers, ...media.themes].join(" ").toLowerCase();
      if (!haystack.includes(state.query.toLowerCase())) return false;
    }
    return true;
  });
}

function populateSelect(select, values, placeholder) {
  const current = select.value;
  select.replaceChildren(new Option(placeholder, ""), ...values.map((value) => new Option(value, value)));
  select.value = values.includes(current) ? current : "";
}

function refreshFilters() {
  const source = state.kind === "video" ? state.catalog.videos : state.catalog.images;
  const visible = source.filter(isRevealed);
  populateSelect(byId("collection-performer-filter"), unique(visible.flatMap((media) => media.performers)), "Tous les performers");
  populateSelect(byId("collection-theme-filter"), unique(visible.flatMap((media) => media.themes)), "Tous les thèmes");
}

function mediaStatus(media) {
  if (!isRevealed(media)) return "Contenu non découvert";
  if (!media.available) return "Média actuellement indisponible";
  if (media.kind === "image") return "Débloquée";
  return isVideoCompleted(media) ? "Terminée" : "Découverte — Non terminée";
}

function createMediaCard(media) {
  const revealed = isRevealed(media);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `collection-card${revealed ? "" : " is-locked"}${media.available ? "" : " is-unavailable"}`;
  button.disabled = !revealed || !media.available;
  const preview = document.createElement("span");
  preview.className = "collection-card-preview";
  if (revealed && media.thumbnailPath) {
    const image = document.createElement("img"); image.src = media.thumbnailPath; image.alt = ""; preview.append(image);
  } else preview.textContent = revealed ? "Aperçu indisponible" : "🔒";
  const copy = document.createElement("span"); copy.className = "collection-card-copy";
  const title = document.createElement("strong"); title.textContent = revealed ? media.title : "???";
  const metadata = document.createElement("small");
  metadata.textContent = revealed ? [...media.performers, ...media.themes].join(" · ") || "Aucune métadonnée" : "Informations masquées";
  const status = document.createElement("em"); status.textContent = mediaStatus(media);
  copy.append(title, metadata, status);
  button.append(preview, copy);
  button.addEventListener("click", () => openMedia(media));
  return button;
}

function render() {
  refreshFilters();
  const media = getFilteredMedia();
  const total = state.kind === "video" ? state.catalog.videos.length : state.catalog.images.length;
  const discovered = (state.kind === "video" ? state.catalog.videos : state.catalog.images).filter(isRevealed).length;
  byId("collection-count").textContent = `${discovered} / ${total} ${state.kind === "video" ? "vidéos découvertes" : "images débloquées"}`;
  const grid = byId("collection-grid");
  grid.replaceChildren(...media.map(createMediaCard));
  byId("collection-empty").hidden = media.length > 0;
}

function closeViewer() {
  const viewer = byId("collection-viewer");
  const video = byId("collection-video");
  video.pause(); video.removeAttribute("src"); video.load();
  byId("collection-image").removeAttribute("src");
  viewer.hidden = true; state.activeMedia = null;
}

function selectedFunscript(media) {
  const difficulty = byId("collection-difficulty").value;
  return media.funscripts?.[difficulty] ?? media.funscripts?.default ?? Object.values(media.funscripts ?? {})[0] ?? null;
}

function dispatchCollectionPlaybackEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail: { playbackContext: "collection", mediaId: state.activeMedia?.id, ...detail } }));
}

function openMedia(media) {
  state.activeMedia = media;
  const viewer = byId("collection-viewer"); viewer.hidden = false;
  byId("collection-viewer-title").textContent = media.title;
  const video = byId("collection-video");
  const image = byId("collection-image");
  const controls = byId("collection-video-controls");
  if (media.kind === "video") {
    image.hidden = true; video.hidden = false; controls.hidden = false;
    video.src = media.videoPath;
    const select = byId("collection-difficulty");
    select.replaceChildren(...media.difficulties.map((difficulty) => new Option(difficulty, difficulty)));
    select.disabled = media.difficulties.length <= 1;
    dispatchCollectionPlaybackEvent("chv1:collection-video-opened", { videoPath: media.videoPath, funscriptPath: selectedFunscript(media) });
  } else {
    video.hidden = true; controls.hidden = true; image.hidden = false; image.src = media.imagePath;
  }
}

function bindUi() {
  document.querySelectorAll("[data-collection-kind]").forEach((button) => button.addEventListener("click", () => {
    state.kind = button.dataset.collectionKind;
    document.querySelectorAll("[data-collection-kind]").forEach((entry) => entry.classList.toggle("is-active", entry === button));
    render();
  }));
  byId("collection-search").addEventListener("input", (event) => { state.query = event.target.value.trim(); render(); });
  byId("collection-performer-filter").addEventListener("change", (event) => { state.performer = event.target.value; render(); });
  byId("collection-theme-filter").addEventListener("change", (event) => { state.theme = event.target.value; render(); });
  byId("collection-state-filter").addEventListener("change", (event) => { state.unlockState = event.target.value; render(); });
  byId("collection-close-viewer").addEventListener("click", closeViewer);
  byId("collection-play-pause").addEventListener("click", () => {
    const video = byId("collection-video"); video.paused ? video.play() : video.pause();
  });
  byId("collection-backward").addEventListener("click", () => { const video = byId("collection-video"); video.currentTime = Math.max(0, video.currentTime - 10); });
  byId("collection-forward").addEventListener("click", () => { const video = byId("collection-video"); video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); });
  byId("collection-volume").addEventListener("input", (event) => { byId("collection-video").volume = Number(event.target.value); });
  byId("collection-speed").addEventListener("change", (event) => { byId("collection-video").playbackRate = Number(event.target.value); });
  byId("collection-difficulty").addEventListener("change", () => dispatchCollectionPlaybackEvent("chv1:collection-funscript-changed", { funscriptPath: selectedFunscript(state.activeMedia) }));
  byId("collection-handy-toggle").addEventListener("change", (event) => dispatchCollectionPlaybackEvent("chv1:collection-handy-toggle", { enabled: event.target.checked, funscriptPath: selectedFunscript(state.activeMedia) }));
  byId("collection-video").addEventListener("seeking", () => dispatchCollectionPlaybackEvent("chv1:collection-video-seek", { currentTime: byId("collection-video").currentTime }));
  byId("collection-video").addEventListener("pause", () => dispatchCollectionPlaybackEvent("chv1:collection-video-pause"));
  byId("collection-video").addEventListener("play", () => dispatchCollectionPlaybackEvent("chv1:collection-video-play", { funscriptPath: selectedFunscript(state.activeMedia) }));
}

function bindNavigation() {
  const collectionTab = byId("collection-navigation-tab");
  const mapTab = byId("map-navigation-tab");
  collectionTab.addEventListener("click", () => {
    document.querySelectorAll(".game-screen").forEach((screen) => { screen.hidden = screen.id !== "collection-screen"; });
    collectionTab.classList.add("is-active"); mapTab.classList.remove("is-active");
    byId("declare-defeat-button").hidden = true;
    render();
  });
  mapTab.addEventListener("click", () => {
    closeViewer();
    document.querySelectorAll(".game-screen").forEach((screen) => { screen.hidden = screen.id !== "map-screen"; });
    mapTab.classList.add("is-active"); collectionTab.classList.remove("is-active");
    byId("declare-defeat-button").hidden = false;
  });
}

async function initialize() {
  if (!globalThis.chv1Media || !globalThis.chv1Collection) return;
  bindUi(); bindNavigation();
  const [catalog, collection] = await Promise.all([globalThis.chv1Media.scanLibrary(), globalThis.chv1Collection.get()]);
  state.catalog = { videos: catalog.videos ?? catalog.entries ?? [], images: catalog.images ?? [] };
  state.collection = collection ?? { videos: {}, images: {} };
  render();
}

window.addEventListener("DOMContentLoaded", initialize);
