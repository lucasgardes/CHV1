"use strict";

const EVENT_THEMES = new Map([
  ["Le coffre d’obéissance", ["discovery", "▣"]],
  ["Les trois casiers", ["discovery", "▥"]],
  ["Le matériel confisqué", ["discovery", "◇"]],
  ["Les deux portes", ["choice", "⌁"]],
  ["Le sacrifice calculé", ["choice", "△"]],
  ["Le dilemme du repos", ["choice", "◷"]],
  ["La porte condamnée", ["choice", "▤"]],
  ["Le faux blessé", ["prisoner", "◎"]],
  ["La panne d’éclairage", ["incident", "ϟ"]],
  ["Le verrouillage total", ["incident", "⛓"]]
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

  button.replaceChildren(icon, text);
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
  if (card instanceof HTMLElement && !card.querySelector(".event-scene-symbol")) {
    const symbol = document.createElement("div");
    symbol.className = "event-scene-symbol";
    symbol.setAttribute("aria-hidden", "true");
    card.insertBefore(symbol, card.querySelector(".screen-kicker"));
  }

  const isResolution = title.textContent?.trim() === "Résultat";
  screen.classList.toggle("is-resolution", isResolution);
  screen.classList.remove("event-theme-discovery", "event-theme-choice", "event-theme-prisoner", "event-theme-incident", "event-theme-trial");

  const eventTitle = isResolution ? screen.dataset.lastEventTitle : title.textContent?.trim();
  if (!isResolution && eventTitle) screen.dataset.lastEventTitle = eventTitle;
  const [theme = "trial", symbol = "?"] = EVENT_THEMES.get(eventTitle) || [];
  screen.classList.add(`event-theme-${theme}`);

  const emblem = card?.querySelector(".event-scene-symbol");
  setTextIfChanged(emblem, isResolution ? "✓" : symbol);

  const kicker = card?.querySelector(".screen-kicker");
  setTextIfChanged(kicker, isResolution ? "Conséquences appliquées" : "Protocole imprévu");

  for (const button of choices.querySelectorAll("button")) decorateButton(button);
}

function initialize() {
  ensureStylesheet();
  const screen = document.getElementById("event-screen");
  if (!(screen instanceof HTMLElement)) return;
  const observer = new MutationObserver(refreshEventUi);
  observer.observe(screen, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
  refreshEventUi();
}

window.addEventListener("DOMContentLoaded", initialize);
