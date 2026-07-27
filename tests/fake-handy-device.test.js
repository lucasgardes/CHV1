"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import {
  sendPositionCommand,
  stopDevice,
  supportsPositionControl
} from "../src/modules/handy-device.js";
import { FakeHandyDevice } from "../src/modules/fake-handy-device.js";

test("le faux Handy expose le contrôle de position attendu", () => {
  const device = new FakeHandyDevice();

  assert.equal(supportsPositionControl(device), true);
  assert.equal(device.features.outputs[0].type, "HwPositionWithDuration");
});

test("les commandes de position sont enregistrées sans matériel réel", async () => {
  const device = new FakeHandyDevice({ featureIndex: 3 });

  await sendPositionCommand(device, 0.75, 420);

  const command = device.getLastCommand();
  assert.equal(command.featureIndex, 3);
  assert.deepEqual(command.command, {
    HwPositionWithDuration: {
      Value: 75,
      Duration: 420
    }
  });
});

test("les positions sont limitées entre 0 et 100 pour les tests", async () => {
  const device = new FakeHandyDevice();

  await sendPositionCommand(device, 2, 500);
  await sendPositionCommand(device, -1, 500);

  const commands = device.getCommands();
  assert.equal(commands[0].command.HwPositionWithDuration.Value, 100);
  assert.equal(commands[1].command.HwPositionWithDuration.Value, 0);
});

test("l'arrêt simulé est observable par les tests", async () => {
  const device = new FakeHandyDevice();

  const result = await stopDevice(device);

  assert.equal(result.success, true);
  assert.equal(device.stopped, true);
  assert.equal(device.stopCount, 1);
});
