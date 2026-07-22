"use strict";

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.id) element.id = options.id;
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.type) element.type = options.type;
  if (options.hidden) element.hidden = true;

  return element;
}

function createShopScreen() {
  const screen = createElement("section", {
    id: "shop-screen",
    className: "game-screen room-screen",
    hidden: true
  });

  const kicker = createElement("p", {
    className: "screen-kicker",
    text: "Commerce"
  });
  const title = createElement("h2", { text: "Boutique" });
  const description = createElement("p", {
    className: "screen-description",
    text: "Achète des objets ou renouvelle le stock avant de poursuivre."
  });

  const toolbar = createElement("div", { className: "room-toolbar" });
  const gold = createElement("p", { className: "room-gold" });
  gold.append("Or : ", createElement("strong", {
    id: "shop-gold-value",
    text: "0"
  }));

  const reroll = createElement("button", {
    id: "shop-reroll-button",
    className: "secondary-button",
    type: "button",
    text: "Renouveler le stock"
  });
  toolbar.append(gold, reroll);

  const stock = createElement("div", {
    id: "shop-stock-list",
    className: "room-card-grid"
  });

  const leave = createElement("button", {
    id: "shop-leave-button",
    className: "primary-button",
    type: "button",
    text: "Quitter la boutique"
  });

  screen.append(kicker, title, description, toolbar, stock, leave);
  return screen;
}

function createCampfireScreen() {
  const screen = createElement("section", {
    id: "campfire-screen",
    className: "game-screen room-screen",
    hidden: true
  });

  const kicker = createElement("p", {
    className: "screen-kicker",
    text: "Halte"
  });
  const title = createElement("h2", { text: "Feu de camp" });
  const description = createElement("p", {
    id: "campfire-message",
    className: "screen-description room-message",
    text: "Choisis une seule action."
  });

  const choices = createElement("div", {
    id: "campfire-main-choices",
    className: "room-actions"
  });

  const rest = createElement("button", {
    id: "campfire-rest-button",
    className: "room-action-button",
    type: "button"
  });
  rest.append(
    createElement("strong", { text: "Se reposer" }),
    createElement("span", {
      text: "Recharge immédiatement tous les objets rechargeables."
    })
  );

  const upgrade = createElement("button", {
    id: "campfire-upgrade-button",
    className: "room-action-button primary-button",
    type: "button"
  });
  upgrade.append(
    createElement("strong", { text: "Améliorer un objet" }),
    createElement("span", {
      text: "Choisis un objet possédé qui n’a pas encore été amélioré."
    })
  );

  choices.append(rest, upgrade);

  const upgradeList = createElement("div", {
    id: "campfire-upgrade-list",
    className: "room-upgrade-list",
    hidden: true
  });

  screen.append(kicker, title, description, choices, upgradeList);
  return screen;
}

const shell = document.querySelector(".app-shell");

if (!(shell instanceof HTMLElement)) {
  throw new Error("Le conteneur principal de l’application est introuvable.");
}

shell.insertBefore(createShopScreen(), document.getElementById("settings-panel"));
shell.insertBefore(createCampfireScreen(), document.getElementById("settings-panel"));
