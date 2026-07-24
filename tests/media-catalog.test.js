"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeId,
  validateFunscriptData,
  validateMetadataShape,
  buildVideoMetadata,
  chooseDifficulty
} = require("../media/catalog.js");

test("normalizeId produit un identifiant permanent sûr", () => {
  assert.equal(normalizeId("É-Girl Office 001"), "e-girl-office-001");
  assert.equal(normalizeId("  Policewoman__Elite  "), "policewoman-elite");
});

test("un funscript valide impose des actions ordonnées et des positions entre 0 et 100", () => {
  assert.deepEqual(validateFunscriptData({ actions:[{ at:0, pos:10 }, { at:500, pos:90 }] }), []);
  assert.deepEqual(validateFunscriptData({ actions:[{ at:500, pos:101 }, { at:100, pos:20 }] }), [
    "action-0-invalid-pos",
    "action-1-out-of-order"
  ]);
});

test("buildVideoMetadata génère un metadata.json cohérent", () => {
  const metadata = buildVideoMetadata({
    title:"Office Secretary 01",
    type:"normal",
    durationSeconds:218,
    themes:["Office", "secretary"],
    performers:["Anna"],
    videoFile:"source.mp4",
    funscripts:[
      { difficulty:"easy", filename:"easy.funscript" },
      { difficulty:"hard", filename:"hard.funscript" }
    ]
  });
  assert.equal(metadata.id, "office-secretary-01");
  assert.deepEqual(metadata.difficulties, ["easy", "hard"]);
  assert.deepEqual(validateMetadataShape(metadata, "video"), []);
});

test("la validation refuse les chemins sortant du dossier et les difficultés inconnues", () => {
  const metadata = buildVideoMetadata({ title:"Test", videoFile:"video.mp4", funscripts:[{ difficulty:"normal", filename:"normal.funscript" }] });
  metadata.videoFile = "../video.mp4";
  metadata.funscripts.extreme = "extreme.funscript";
  const errors = validateMetadataShape(metadata, "video");
  assert.ok(errors.includes("invalid-video-file"));
  assert.ok(errors.includes("invalid-difficulty:extreme"));
});

test("le fallback de difficulté reste explicite", () => {
  assert.deepEqual(chooseDifficulty({ normal:"normal.funscript" }, "hard"), {
    requestedDifficulty:"hard",
    selectedDifficulty:"normal",
    fallbackUsed:true
  });
});
