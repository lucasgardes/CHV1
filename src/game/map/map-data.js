"use strict";

export const MAP_NODES = Object.freeze([
  {
    id: "start",
    type: "start",
    title: "Départ",
    nextNodeIds: ["normal-1"]
  },
  {
    id: "normal-1",
    type: "normal",
    title: "Rencontre normale",
    encounterId: "normal-001",
    nextNodeIds: ["event-1", "normal-2"]
  },
  {
    id: "event-1",
    type: "event",
    title: "Événement mystère",
    eventId: "event-001",
    nextNodeIds: ["elite-1"]
  },
  {
    id: "normal-2",
    type: "normal",
    title: "Rencontre normale",
    encounterId: "normal-002",
    nextNodeIds: ["elite-1"]
  },
  {
    id: "elite-1",
    type: "elite",
    title: "Élite",
    encounterId: "elite-001",
    nextNodeIds: ["boss-1"]
  },
  {
    id: "boss-1",
    type: "boss",
    title: "Boss final",
    encounterId: "boss-001",
    nextNodeIds: []
  }
]);

export function getMapNodeById(nodeId) {
  return MAP_NODES.find((node) => node.id === nodeId) ?? null;
}