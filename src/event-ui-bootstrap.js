"use strict";

const DEFAULT_EVENT_ILLUSTRATION = "../assets/illustrations/events/event-placeholder.svg";

const EVENT_THEMES = new Map([
  ["Le coffre d’obéissance", ["discovery", "▣", DEFAULT_EVENT_ILLUSTRATION]],
  ["Les trois casiers", ["discovery", "▥", DEFAULT_EVENT_ILLUSTRATION]],
  ["Le matériel confisqué", ["discovery", "◇", DEFAULT_EVENT_ILLUSTRATION]],
  ["Les deux portes", ["choice", "⌁", DEFAULT_EVENT_ILLUSTRATION]],
  ["Le sacrifice calculé", ["choice", "△", DEFAULT_EVENT_ILLUSTRATION]],
  ["Le dilemme du repos", ["choice", "◷", DEFAULT_EVENT_ILLUSTRATION]],
  ["La porte condamnée", ["choice", "▤", DEFAULT_EVENT_ILLUSTRATION]],
  ["Le faux blessé", ["prisoner", "◎", DEFAULT_EVENT_ILLUSTRATION]],
  ["La panne d’éclairage", ["incident", "ϟ", DEFAULT_EVENT_ILLUSTRATION]],
  ["Le verrouillage total", ["incident", "⛓", DEFAULT_EVENT_ILLUSTRATION]]
]);

function ensureStylesheet() {
  if (document.querySelector('link[data-event-ui-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./event-ui.css";
  link.dataset.eventUiStyles = "true";
  document.head.append(link);
}

function inferChoiceIcon(label) {
  const normalized = String(label || "").toLocaleLowerCase("fr-FR");
  if (normalized.includes("porte")) return "▯";
  if (normalized.includes("coffre") || normalized.includes("casier")) return "▣";
  if (/\bor\b/u.test(normalized) || normalized.includes("payer") || normalized.includes("pièce")) return "●";
  if (normalized.includes("temps") || normalized.includes("pause") || normalized.includes("chronomètre")) return "◷";
  if (normalized.includes("objet") || normalized.includes("équipement") || normalized.includes("matériel")) return "◇";
  if (normalized.includes("attendre") || normalized.includes("rester")) return "…";
  if (normalized.includes("interroger") || normalized.includes("parler")) return "◌";
  if (normalized.includes("ouvrir")) return "＋";
  if (normalized.includes("quitter") || normalized.includes("refuser")) return "←";
  if (normalized.includes("protéger")) return "⬡";
  if (normalized.includes("sanction") || normalized.includes("épreuve")) return "△";
  if (normalized.includes("utiliser")) return "◆";
  if (normalized.includes("continuer")) return "→";
  return "?";
}

function decorateButton(button) {
  if (!(button instanceof HTMLButtonElement) || button.dataset.eventUiDecorated === "true") return;
  const label = button.textContent?.trim() || "Choisir";
  button.dataset.eventUiDecorated = "true";
  if (label.startsWith("Utiliser ")) button.classList.add("event-choice-tool");

  const icon = document.createElement("span");
  icon.className = "event-choice-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = inferChoiceIcon(label);

  const text = document.createElement("span");
  text.className = "event-choice-label";
  text.textContent = label;

  const arrow = document.createElement("span");
  arrow.className = "event-choice-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";

  button.replaceChildren(icon, text, arrow);
}

function ensureIllustration(card) {
  let figure = card.querySelector(".event-illustration");
  if (figure instanceof HTMLElement) return figure;
  figure = document.createElement("figure");
  figure.className = "event-illustration";
  const image = document.createElement("img");
  image.alt = "Illustration de l’événement";
  image.decoding = "async";
  image.draggable = false;
  const veil = document.createElement("span");
  veil.className = "event-illustration__veil";
  veil.setAttribute("aria-hidden", "true");
  figure.append(image, veil);
  card.insertBefore(figure, card.firstChild);
  return figure;
}

function setTextIfChanged(element, value) {
  if (element instanceof HTMLElement && element.textContent !== value) element.textContent = value;
}

function refreshEventUi() {
  const screen = document.getElementById("event-screen");
  const title = document.getElementById("event-title");
  const choices = document.getElementById("event-choice-list");
  if (!(screen instanceof HTMLElement) || !(title instanceof HTMLElement) || !(choices instanceof HTMLElement)) return;

  const card = screen.querySelector(".modal-card");
  if (!(card instanceof HTMLElement)) return;
  card.classList.add("event-cinematic-card");
  const figure = ensureIllustration(card);

  const isResolution = title.textContent?.trim() === "Résultat";
  screen.classList.toggle("is-resolution", isResolution);
  screen.classList.remove("event-theme-discovery", "event-theme-choice", "event-theme-prisoner", "event-theme-incident", "event-theme-trial");

  const eventTitle = isResolution ? screen.dataset.lastEventTitle : title.textContent?.trim();
  if (!isResolution && eventTitle) screen.dataset.lastEventTitle = eventTitle;
  const [theme = "trial", symbol = "?", illustration = DEFAULT_EVENT_ILLUSTRATION] = EVENT_THEMES.get(eventTitle) || [];
  screen.classList.add(`event-theme-${theme}`);

  const image = figure.querySelector("img");
  if (image instanceof HTMLImageElement && image.getAttribute("src") !== illustration) image.src = illustration;
  figure.hidden = isResolution;

  let emblem = card.querySelector(".event-scene-symbol");
  if (!(emblem instanceof HTMLElement)) {
    emblem = document.createElement("div");
    emblem.className = "event-scene-symbol";
    emblem.setAttribute("aria-hidden", "true");
    card.insertBefore(emblem, card.querySelector(".screen-kicker"));
  }
  setTextIfChanged(emblem, isResolution ? "✓" : symbol);

  const kicker = card.querySelector(".screen-kicker");
  setTextIfChanged(kicker, isResolution ? "Conséquences appliquées" : "Événement");

  for (const button of choices.querySelectorAll("button")) decorateButton(button);
}

function initialize() {
  ensureStylesheet();
  const screen = document.getElementById("event-screen");
  if (!(screen instanceof HTMLElement)) return;
  const observer = new MutationObserver(refreshEventUi);
  observer.observe(screen, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["hidden"] });
  refreshEventUi();
}

window.addEventListener("DOMContentLoaded", initialize);
