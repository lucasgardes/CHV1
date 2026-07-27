"use strict";

/**
 * Appareil Handy simulé pour les tests automatisés.
 *
 * Il expose la même surface minimale que l'appareil utilisé par
 * handy-device.js : canOutput(), features.outputs, output() et stop().
 * Aucune connexion à Intiface Central ni aucun matériel réel n'est requis.
 */
export class FakeHandyDevice {
  constructor({ name = "Fake Handy", featureIndex = 0 } = {}) {
    this.name = name;
    this.displayName = name;
    this.features = {
      outputs: [
        {
          index: featureIndex,
          type: "HwPositionWithDuration"
        }
      ]
    };
    this.commandLog = [];
    this.stopCount = 0;
    this.stopped = false;
  }

  canOutput(type) {
    return type === "Position" || type === "HwPositionWithDuration";
  }

  async output(payload) {
    const snapshot = JSON.parse(JSON.stringify(payload));
    this.commandLog.push({
      ...snapshot,
      timestamp: Date.now()
    });
    this.stopped = false;
  }

  async stop() {
    this.stopCount += 1;
    this.stopped = true;
  }

  getCommands() {
    return this.commandLog.map((command) => ({ ...command }));
  }

  getLastCommand() {
    const command = this.commandLog.at(-1);
    return command ? { ...command } : null;
  }

  clearCommands() {
    this.commandLog.length = 0;
  }
}

export function createFakeHandyDevice(options = {}) {
  return new FakeHandyDevice(options);
}
