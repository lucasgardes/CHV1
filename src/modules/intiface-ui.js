"use strict";

export class IntifaceUIController {
  constructor({
    intiface,
    formatError,
    onStateChange = () => {},
    onDeviceAdded = () => {},
    onDeviceRemoved = () => {},
    onDisconnected = () => {},
    beforeDisconnect = async () => {}
  }) {
    if (intiface === null || typeof intiface !== "object") {
      throw new Error("Le contrôleur Intiface est invalide.");
    }

    if (typeof formatError !== "function") {
      throw new Error("formatError doit être une fonction.");
    }

    this.intiface = intiface;
    this.formatError = formatError;

    this.onStateChange = onStateChange;
    this.onDeviceAdded = onDeviceAdded;
    this.onDeviceRemoved = onDeviceRemoved;
    this.onDisconnected = onDisconnected;
    this.beforeDisconnect = beforeDisconnect;

    this.intifaceStatusElement =
      document.querySelector("#intiface-status");

    this.connectionIndicator =
      document.querySelector("#connection-indicator");

    this.serverAddressInput =
      document.querySelector("#server-address");

    this.connectButton =
      document.querySelector("#connect-button");

    this.scanButton =
      document.querySelector("#scan-button");

    this.stopScanButton =
      document.querySelector("#stop-scan-button");

    this.disconnectButton =
      document.querySelector("#disconnect-button");

    this.scanStatusElement =
      document.querySelector("#scan-status");

    this.deviceListElement =
      document.querySelector("#device-list");

    this.deviceControlStatusElement =
      document.querySelector("#device-control-status");

    this.validateElements();
    this.registerEvents();
    this.refresh(this.intiface.state);
  }

  validateElements() {
    if (
      !(this.intifaceStatusElement instanceof HTMLElement)
    ) {
      throw new Error(
        "Le statut Intiface est introuvable."
      );
    }

    if (
      !(this.connectionIndicator instanceof HTMLElement)
    ) {
      throw new Error(
        "L'indicateur de connexion est introuvable."
      );
    }

    if (
      !(this.serverAddressInput instanceof HTMLInputElement)
    ) {
      throw new Error(
        "Le champ d'adresse Intiface est introuvable."
      );
    }

    const buttons = [
      this.connectButton,
      this.scanButton,
      this.stopScanButton,
      this.disconnectButton
    ];

    if (
      buttons.some(
        (button) => !(button instanceof HTMLButtonElement)
      )
    ) {
      throw new Error(
        "Un ou plusieurs boutons Intiface sont introuvables."
      );
    }

    if (!(this.scanStatusElement instanceof HTMLElement)) {
      throw new Error(
        "Le statut du scan Intiface est introuvable."
      );
    }

    if (
      !(this.deviceListElement instanceof HTMLUListElement)
    ) {
      throw new Error(
        "La liste des appareils est introuvable."
      );
    }

    if (
      !(this.deviceControlStatusElement instanceof HTMLElement)
    ) {
      throw new Error(
        "Le statut de contrôle de l'appareil est introuvable."
      );
    }
  }

  setConnectionIndicator(state) {
    this.connectionIndicator.classList.remove(
      "connected",
      "error"
    );

    if (state === "connected") {
      this.connectionIndicator.classList.add(
        "connected"
      );
    }

    if (state === "error") {
      this.connectionIndicator.classList.add(
        "error"
      );
    }
  }

  updateButtons(state = this.intiface.state) {
    this.connectButton.disabled = state.connected;
    this.serverAddressInput.disabled = state.connected;

    this.scanButton.disabled =
      !state.connected || state.scanning;

    this.stopScanButton.disabled =
      !state.connected || !state.scanning;

    this.disconnectButton.disabled =
      !state.connected;
  }

  renderDeviceList(devices = this.intiface.devices) {
    this.deviceListElement.replaceChildren();

    if (devices.length === 0) {
      const emptyMessage = document.createElement("li");

      emptyMessage.className =
        "empty-device-message";

      emptyMessage.textContent =
        "Aucun appareil détecté";

      this.deviceListElement.append(emptyMessage);
      return;
    }

    for (const device of devices) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      const details = document.createElement("span");

      item.className = "device-card";

      name.textContent =
        device.displayName ?? device.name;

      details.textContent =
        `Index Intiface : ${device.index}`;

      item.append(name, details);
      this.deviceListElement.append(item);
    }
  }

  refresh(state = this.intiface.state) {
    this.renderDeviceList(state.devices);
    this.updateButtons(state);
    this.onStateChange(state);
  }

  handleDeviceAdded(device) {
    const deviceName =
      device.displayName ?? device.name;

    console.log(`Appareil détecté : ${deviceName}`);
    console.log(
      "Sorties disponibles :",
      device.features.outputs
    );
    console.log(
      "Contrôle Position :",
      device.canOutput("Position")
    );
    console.log(
      "Contrôle HwPositionWithDuration :",
      device.canOutput("HwPositionWithDuration")
    );

    this.scanStatusElement.textContent =
      `Appareil détecté : ${deviceName}`;

    this.deviceControlStatusElement.textContent =
      `Appareil sélectionné : ${deviceName}`;

    this.onDeviceAdded(device);
  }

  handleDeviceRemoved(device) {
    const deviceName =
      device.displayName ?? device.name;

    console.log(
      `Appareil déconnecté : ${deviceName}`
    );

    this.deviceControlStatusElement.textContent =
      "L’appareil sélectionné a été déconnecté.";

    this.onDeviceRemoved(device);
  }

  handleScanFinished(deviceCount) {
    this.scanStatusElement.textContent =
      `Recherche terminée : ${deviceCount} appareil(s).`;
  }

  handleDisconnected() {
    this.intifaceStatusElement.textContent =
      "Connexion perdue";

    this.scanStatusElement.textContent =
      "La connexion avec Intiface Central a été interrompue.";

    this.deviceControlStatusElement.textContent =
      "Connexion à l'appareil perdue.";

    this.setConnectionIndicator("error");
    this.onDisconnected();
  }

  handleConnectionError(error) {
    console.error(
      "Erreur de connexion Intiface :",
      error
    );
  }

  async connect() {
    const address =
      this.serverAddressInput.value.trim();

    if (address.length === 0) {
      this.intifaceStatusElement.textContent =
        "Adresse manquante";

      this.setConnectionIndicator("error");
      return;
    }

    this.connectButton.disabled = true;

    this.intifaceStatusElement.textContent =
      "Connexion...";

    this.scanStatusElement.textContent =
      "Connexion au serveur Intiface Central...";

    try {
      await this.intiface.connect(address);

      this.intifaceStatusElement.textContent =
        "Connecté";

      this.scanStatusElement.textContent =
        "Connexion réussie. Tu peux lancer la recherche.";

      this.setConnectionIndicator("connected");
    } catch (error) {
      console.error(
        "Échec de la connexion à Intiface Central :",
        error
      );

      this.intifaceStatusElement.textContent =
        "Échec de connexion";

      this.scanStatusElement.textContent =
        this.formatError(error);

      this.setConnectionIndicator("error");
    } finally {
      this.refresh();
    }
  }

  async startScanning() {
    const state = this.intiface.state;

    if (!state.connected || state.scanning) {
      return;
    }

    this.scanStatusElement.textContent =
      "Recherche en cours… Allume The Handy et active son mode Bluetooth.";

    try {
      await this.intiface.startScanning();
    } catch (error) {
      console.error(
        "Impossible de démarrer la recherche :",
        error
      );

      this.scanStatusElement.textContent =
        this.formatError(error);
    } finally {
      this.refresh();
    }
  }

  async stopScanning() {
    const state = this.intiface.state;

    if (!state.connected || !state.scanning) {
      return;
    }

    this.stopScanButton.disabled = true;

    try {
      await this.intiface.stopScanning();

      this.scanStatusElement.textContent =
        `${this.intiface.devices.length} appareil(s) détecté(s).`;
    } catch (error) {
      console.error(
        "Impossible d'arrêter la recherche :",
        error
      );

      this.scanStatusElement.textContent =
        this.formatError(error);
    } finally {
      this.refresh();
    }
  }

  async disconnect() {
    if (!this.intiface.connected) {
      return;
    }

    this.disconnectButton.disabled = true;

    try {
      await this.beforeDisconnect();
      await this.intiface.disconnect();
    } catch (error) {
      console.error(
        "Erreur pendant la déconnexion :",
        error
      );
    } finally {
      this.intifaceStatusElement.textContent =
        "Déconnecté";

      this.scanStatusElement.textContent =
        "Connecte d'abord CHV1 à Intiface Central.";

      this.deviceControlStatusElement.textContent =
        "Aucun appareil sélectionné.";

      this.setConnectionIndicator("disconnected");
      this.refresh();
    }
  }

  registerEvents() {
    this.connectButton.addEventListener(
      "click",
      () => void this.connect()
    );

    this.scanButton.addEventListener(
      "click",
      () => void this.startScanning()
    );

    this.stopScanButton.addEventListener(
      "click",
      () => void this.stopScanning()
    );

    this.disconnectButton.addEventListener(
      "click",
      () => void this.disconnect()
    );
  }
}
