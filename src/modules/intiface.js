"use strict";

import {
  ButtplugClient
} from "@zendrex/buttplug.js";

export class IntifaceController {
  constructor({
    clientName = "CHV1",
    verbose = false,
    onStateChange = () => {},
    onDeviceAdded = () => {},
    onDeviceRemoved = () => {},
    onScanFinished = () => {},
    onDisconnected = () => {},
    onConnectionError = () => {}
  } = {}) {
    this.clientName = clientName;
    this.verbose = verbose;

    this.onStateChange = onStateChange;
    this.onDeviceAdded = onDeviceAdded;
    this.onDeviceRemoved = onDeviceRemoved;
    this.onScanFinished = onScanFinished;
    this.onDisconnected = onDisconnected;
    this.onConnectionError = onConnectionError;

    this.client = null;
    this.connected = false;
    this.scanning = false;
    this.selectedDevice = null;
  }

  get devices() {
    return this.client?.devices ?? [];
  }

  get state() {
    return {
      connected: this.connected,
      scanning: this.scanning,
      selectedDevice: this.selectedDevice,
      devices: this.devices
    };
  }

  emitState() {
    this.onStateChange(this.state);
  }

  registerEvents(client) {
    client.on(
      "device.added",
      ({ data: { device } }) => {
        if (client !== this.client) {
          return;
        }

        this.selectedDevice = device;
        this.onDeviceAdded(device);
        this.emitState();
      }
    );

    client.on(
      "device.removed",
      ({ data: { device } }) => {
        if (client !== this.client) {
          return;
        }

        if (this.selectedDevice?.index === device.index) {
          this.selectedDevice = null;
        }

        this.onDeviceRemoved(device);
        this.emitState();
      }
    );

    client.on("scan.finished", () => {
      if (client !== this.client) {
        return;
      }

      this.scanning = false;
      this.onScanFinished(this.devices.length);
      this.emitState();
    });

    client.on("connection.disconnected", () => {
      if (client !== this.client) {
        return;
      }

      this.connected = false;
      this.scanning = false;
      this.selectedDevice = null;

      this.onDisconnected();
      this.emitState();
    });

    client.on(
      "connection.error",
      ({ data }) => {
        if (client === this.client) {
          this.onConnectionError(data);
        }
      }
    );
  }

  async connect(address) {
    if (this.connected) {
      return;
    }

    if (typeof address !== "string" || address.trim() === "") {
      throw new Error("Adresse Intiface manquante.");
    }

    const client = new ButtplugClient(address.trim(), {
      clientName: this.clientName,
      verbose: this.verbose
    });

    this.client = client;
    this.registerEvents(client);

    try {
      await client.connect();

      if (client !== this.client) {
        return;
      }

      this.connected = true;
      this.scanning = false;
      this.selectedDevice = null;
      this.emitState();
    } catch (error) {
      if (client === this.client) {
        this.client = null;
        this.connected = false;
        this.scanning = false;
        this.selectedDevice = null;
        this.emitState();
      }

      try {
        client.dispose();
      } catch (disposeError) {
        console.error(
          "Impossible de libérer le client Intiface :",
          disposeError
        );
      }

      throw error;
    }
  }

  async startScanning() {
    if (
      this.client === null ||
      !this.connected ||
      this.scanning
    ) {
      return;
    }

    this.scanning = true;
    this.emitState();

    try {
      await this.client.startScanning();
    } catch (error) {
      this.scanning = false;
      this.emitState();
      throw error;
    }
  }

  async stopScanning() {
    if (
      this.client === null ||
      !this.connected ||
      !this.scanning
    ) {
      return;
    }

    try {
      await this.client.stopScanning();
    } finally {
      this.scanning = false;
      this.emitState();
    }
  }

  async disconnect() {
    const client = this.client;

    if (client === null) {
      return;
    }

    try {
      if (this.scanning) {
        await client.stopScanning();
      }

      if (this.connected) {
        await client.disconnect();
      }
    } finally {
      try {
        client.dispose();
      } finally {
        if (client === this.client) {
          this.client = null;
          this.connected = false;
          this.scanning = false;
          this.selectedDevice = null;
          this.emitState();
        }
      }
    }
  }
}
