"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

async function importModule(path) { return import(new URL(`../${path}`, import.meta.url)); }

test("la bibliothèque évite les répétitions récentes", async () => {
  const { LocalMediaLibrary } = await importModule("src/game/local-media-library.js");
  const library = new LocalMediaLibrary({ recentLimit:2, random:() => 0 });
  library.loadScan({ entries:[
    { id:"a", videoPath:"file:///a.mp4", funscriptPath:"file:///a.funscript" },
    { id:"b", videoPath:"file:///b.mp4", funscriptPath:"file:///b.funscript" },
    { id:"c", videoPath:"file:///c.mp4", funscriptPath:"file:///c.funscript" }
  ] });
  assert.equal(library.select().id, "a");
  assert.equal(library.select().id, "b");
  assert.equal(library.select().id, "c");
});

test("les vidéos sans funscript sont écartées", async () => {
  const { LocalMediaLibrary } = await importModule("src/game/local-media-library.js");
  const library = new LocalMediaLibrary({ random:() => 0 });
  const diagnostics = library.loadScan({ entries:[
    { id:"broken", videoPath:"file:///broken.mp4", funscriptPath:null },
    { id:"ready", videoPath:"file:///ready.mp4", funscriptPath:"file:///ready.funscript" }
  ] });
  assert.deepEqual(diagnostics.withoutFunscript, ["broken"]);
  assert.equal(library.select({ requireFunscript:true }).id, "ready");
});

test("la durée explicite d'un événement vidéo est comptée", async () => {
  const { estimateRouteDurationMinutes } = await importModule("src/game/map/map-validator.js");
  const route = [
    { type:"start" },
    { type:"normal", durationSeconds:180 },
    { type:"event", hasVideo:true, eventVideoDurationSeconds:120 },
    { type:"elite", durationSeconds:300 },
    { type:"boss", durationSeconds:420 }
  ];
  assert.equal(estimateRouteDurationMinutes(route), 17);
});
