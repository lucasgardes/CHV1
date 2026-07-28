"use strict";

const byId = (id) => document.getElementById(id);
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("fr-FR");

const state = {
  catalog: { videos: [], images: [] },
  collection: { videos: {}, images: {} },
  observer: null,
  viewerObserver: null
};

function ensureStylesheet() {
  if (document.querySelector('link[data-collection-ui-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./collection-ui.css";
  link.dataset.collectionUiStyles = "true";
  document.head.append(link);
}

function mediaProgress(media) {
  return media?.kind === "image"
    ? state.collection.images?.[media.id] ?? {}
    : state.collection.videos?.[media.id] ?? {};
}

function mediaDiscovered(media) {
  const progress = mediaProgress(media);
  return media?.kind === "image" ? Boolean(progress.unlocked) : Boolean(progress.discovered || progress.completed);
}

function mediaCompleted(media) {
  return media?.kind === "video" && Boolean(mediaProgress(media).completed);
}

function isSecret(media) {
  const values = [media?.type, media?.category, media?.rarity, ...(media?.themes ?? []), media?.title];
  return values.some((value) => /secret|cach[eé]|hidden|clandestin/i.test(String(value || "")));
}

function allMedia() {
  return [...(state.catalog.videos ?? []), ...(state.catalog.images ?? [])];
}

function findMediaFromCard(card) {
  const title = card.querySelector(".collection-card-heading strong")?.textContent?.trim();
  if (!title || title === "???") return null;
  return allMedia().find((media) => normalize(media.title) === normalize(title)) ?? null;
}

function installProgressPanel() {
  const panel = document.querySelector(".collection-panel");
  const count = byId("collection-count");
  if (!(panel instanceof HTMLElement) || !(count instanceof HTMLElement)) return;
  let progress = panel.querySelector(".collection-global-progress");
  if (!(progress instanceof HTMLElement)) {
    progress = document.createElement("section");
    progress.className = "collection-global-progress";
    progress.innerHTML = '<div class="collection-global-progress__copy"><span>Progression de la collection</span><strong></strong></div><div class="collection-global-progress__track"><span></span></div><div class="collection-global-progress__stats"></div>';
    count.insertAdjacentElement("afterend", progress);
  }

  const visibleKind = document.querySelector('[data-collection-kind].is-active')?.dataset.collectionKind ?? "video";
  const media = visibleKind === "image" ? state.catalog.images : state.catalog.videos;
  const discovered = media.filter(mediaDiscovered).length;
  const completed = media.filter(mediaCompleted).length;
  const total = media.length;
  const percent = total ? Math.round((discovered / total) * 100) : 0;
  progress.querySelector("strong").textContent = `${percent} %`;
  progress.querySelector(".collection-global-progress__track span").style.width = `${percent}%`;
  progress.querySelector(".collection-global-progress__stats").textContent = visibleKind === "video"
    ? `${discovered} découvertes · ${completed} terminées · ${total} au total`
    : `${discovered} débloquées · ${total} au total`;
}

function lockedPattern(card, index) {
  const preview = card.querySelector(".collection-card-preview");
  if (!(preview instanceof HTMLElement)) return;
  const pattern = index % 6;
  preview.classList.add(`collection-unknown-pattern--${pattern}`);
  preview.replaceChildren();
  const symbol = document.createElement("span");
  symbol.className = "collection-unknown-symbol";
  symbol.textContent = ["?", "◇", "⌁", "▧", "◉", "△"][pattern];
  const code = document.createElement("small");
  code.textContent = `ARCHIVE ${String(index + 1).padStart(3, "0")}`;
  preview.append(symbol, code);
}

function addDifficultyBadges(card, media) {
  if (!media || media.kind !== "video") return;
  let badges = card.querySelector(".collection-difficulty-badges");
  if (!(badges instanceof HTMLElement)) {
    badges = document.createElement("span");
    badges.className = "collection-difficulty-badges";
    card.querySelector(".collection-card-copy")?.append(badges);
  }
  const completedDifficulties = new Set(mediaProgress(media).completedDifficulties ?? []);
  badges.replaceChildren(...(media.difficulties ?? []).map((difficulty) => {
    const badge = document.createElement("span");
    badge.className = `collection-difficulty-badge${completedDifficulties.has(difficulty) ? " is-completed" : ""}`;
    badge.textContent = difficulty;
    badge.title = completedDifficulties.has(difficulty) ? `${difficulty} terminée` : `${difficulty} non terminée`;
    return badge;
  }));
}

function decorateCards() {
  const cards = [...document.querySelectorAll(".collection-card")];
  cards.forEach((card, index) => {
    if (!(card instanceof HTMLButtonElement)) return;
    const media = findMediaFromCard(card);
    const status = normalize(card.querySelector(".collection-card-copy em")?.textContent);
    card.classList.toggle("is-discovered", Boolean(media) && !status.includes("non découvert"));
    card.classList.toggle("is-completed", status.includes("terminée"));
    card.classList.toggle("is-favorite", card.querySelector(".collection-favorite.is-active") !== null);
    card.classList.toggle("is-secret", isSecret(media));
    if (card.classList.contains("is-locked")) lockedPattern(card, index);
    if (media) {
      card.dataset.mediaId = media.id;
      card.dataset.mediaKind = media.kind;
      addDifficultyBadges(card, media);
    }
  });
}

function buildViewerDetails(media) {
  const shell = document.querySelector(".collection-viewer-shell");
  const header = document.querySelector(".collection-viewer-header");
  if (!(shell instanceof HTMLElement) || !(header instanceof HTMLElement)) return;
  let details = shell.querySelector(".collection-viewer-details");
  if (!(details instanceof HTMLElement)) {
    details = document.createElement("aside");
    details.className = "collection-viewer-details";
    header.insertAdjacentElement("afterend", details);
  }
  if (!media) {
    details.hidden = true;
    return;
  }
  const progress = mediaProgress(media);
  const performers = (media.performers ?? []).join(" · ") || "Non renseigné";
  const themes = (media.themes ?? []).join(" · ") || "Non renseigné";
  const completedDifficulties = new Set(progress.completedDifficulties ?? []);
  details.hidden = false;
  details.replaceChildren();

  const status = document.createElement("div");
  status.className = "collection-viewer-details__status";
  status.innerHTML = `<span>${mediaCompleted(media) ? "Terminé" : "Découvert"}</span>${isSecret(media) ? "<span>Secret</span>" : ""}${progress.favorite ? "<span>Favori</span>" : ""}`;
  const metadata = document.createElement("dl");
  metadata.innerHTML = `<div><dt>Type</dt><dd>${media.type ?? "Inconnu"}</dd></div><div><dt>Performers</dt><dd>${performers}</dd></div><div><dt>Thèmes</dt><dd>${themes}</dd></div>`;
  details.append(status, metadata);

  if (media.kind === "video" && (media.difficulties ?? []).length) {
    const difficulty = document.createElement("div");
    difficulty.className = "collection-viewer-details__difficulties";
    difficulty.append(...media.difficulties.map((entry) => {
      const badge = document.createElement("span");
      badge.className = completedDifficulties.has(entry) ? "is-completed" : "";
      badge.textContent = `${completedDifficulties.has(entry) ? "✓" : "○"} ${entry}`;
      return badge;
    }));
    details.append(difficulty);
  }
}

function refreshViewerDetails() {
  const viewer = byId("collection-viewer");
  if (!(viewer instanceof HTMLElement) || viewer.hidden) return;
  const title = byId("collection-viewer-title")?.textContent?.trim();
  const media = allMedia().find((entry) => normalize(entry.title) === normalize(title));
  buildViewerDetails(media);
}

function refresh() {
  installProgressPanel();
  decorateCards();
  refreshViewerDetails();
}

async function loadData() {
  if (!globalThis.chv1Media || !globalThis.chv1Collection) return;
  const [catalog, collection] = await Promise.all([
    globalThis.chv1Media.scanLibrary(),
    globalThis.chv1Collection.get()
  ]);
  state.catalog = {
    videos: catalog.videos ?? catalog.entries ?? [],
    images: catalog.images ?? []
  };
  state.collection = collection ?? { videos: {}, images: {} };
}

async function initialize() {
  ensureStylesheet();
  await loadData();
  const collectionScreen = byId("collection-screen");
  const viewer = byId("collection-viewer");
  if (collectionScreen instanceof HTMLElement) {
    state.observer = new MutationObserver(refresh);
    state.observer.observe(collectionScreen, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["class", "hidden"] });
  }
  if (viewer instanceof HTMLElement) {
    state.viewerObserver = new MutationObserver(refreshViewerDetails);
    state.viewerObserver.observe(viewer, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["hidden"] });
  }
  window.addEventListener("chv1:collection-updated", async () => { await loadData(); refresh(); });
  refresh();
}

window.addEventListener("DOMContentLoaded", initialize);
