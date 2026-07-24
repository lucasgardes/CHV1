"use strict";

const path = require("node:path");

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FUNSCRIPT_EXTENSIONS = new Set([".funscript"]);
const VIDEO_TYPES = new Set(["normal", "elite", "boss", "event", "secret"]);
const IMAGE_TYPES = new Set(["event", "performer", "secret", "special"]);
const DIFFICULTIES = new Set(["easy", "normal", "hard", "default"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeId(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeTags(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(normalizeId)
    .filter(Boolean))];
}

function isSafeRelativeFile(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = path.normalize(value.trim());
  return !path.isAbsolute(normalized)
    && normalized !== ".."
    && !normalized.startsWith(`..${path.sep}`)
    && path.basename(normalized) === normalized;
}

function validateFunscriptData(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) return ["funscript-not-object"];
  if (!Array.isArray(data.actions) || data.actions.length === 0) return ["funscript-actions-missing"];

  let previousAt = -1;
  data.actions.forEach((action, index) => {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      errors.push(`action-${index}-not-object`);
      return;
    }
    const at = Number(action.at);
    const pos = Number(action.pos);
    if (!Number.isFinite(at) || at < 0 || !Number.isInteger(at)) errors.push(`action-${index}-invalid-at`);
    if (!Number.isFinite(pos) || pos < 0 || pos > 100 || !Number.isInteger(pos)) errors.push(`action-${index}-invalid-pos`);
    if (Number.isFinite(at) && at < previousAt) errors.push(`action-${index}-out-of-order`);
    if (Number.isFinite(at)) previousAt = at;
  });
  return errors;
}

function validateMetadataShape(metadata, kind = "video") {
  const errors = [];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ["metadata-not-object"];
  if (metadata.schemaVersion !== 1) errors.push("unsupported-schema-version");
  if (!ID_PATTERN.test(String(metadata.id ?? ""))) errors.push("invalid-id");
  if (!String(metadata.title ?? "").trim()) errors.push("missing-title");

  const validTypes = kind === "image" ? IMAGE_TYPES : VIDEO_TYPES;
  if (!validTypes.has(metadata.type)) errors.push("invalid-type");
  if (metadata.enabled != null && typeof metadata.enabled !== "boolean") errors.push("invalid-enabled");
  if (!Array.isArray(metadata.themes)) errors.push("invalid-themes");
  if (!Array.isArray(metadata.performers)) errors.push("invalid-performers");

  if (kind === "image") {
    if (!isSafeRelativeFile(metadata.imageFile)) errors.push("invalid-image-file");
    else if (!IMAGE_EXTENSIONS.has(path.extname(metadata.imageFile).toLowerCase())) errors.push("unsupported-image-format");
    if (metadata.thumbnailFile && !isSafeRelativeFile(metadata.thumbnailFile)) errors.push("invalid-thumbnail-file");
    return errors;
  }

  if (!isSafeRelativeFile(metadata.videoFile)) errors.push("invalid-video-file");
  else if (!VIDEO_EXTENSIONS.has(path.extname(metadata.videoFile).toLowerCase())) errors.push("unsupported-video-format");
  if (metadata.thumbnailFile && !isSafeRelativeFile(metadata.thumbnailFile)) errors.push("invalid-thumbnail-file");
  if (!Number.isFinite(Number(metadata.durationSeconds)) || Number(metadata.durationSeconds) < 0) errors.push("invalid-duration");
  if (!Number.isFinite(Number(metadata.weight)) || Number(metadata.weight) <= 0) errors.push("invalid-weight");
  if (!metadata.funscripts || typeof metadata.funscripts !== "object" || Array.isArray(metadata.funscripts)) {
    errors.push("invalid-funscripts");
  } else {
    const entries = Object.entries(metadata.funscripts);
    if (!entries.length) errors.push("missing-funscript");
    for (const [difficulty, filename] of entries) {
      if (!DIFFICULTIES.has(difficulty)) errors.push(`invalid-difficulty:${difficulty}`);
      if (!isSafeRelativeFile(filename)) errors.push(`invalid-funscript-file:${difficulty}`);
      else if (!FUNSCRIPT_EXTENSIONS.has(path.extname(filename).toLowerCase())) errors.push(`unsupported-funscript-format:${difficulty}`);
    }
  }
  return errors;
}

function buildVideoMetadata(input = {}) {
  const id = normalizeId(input.id || input.title || "video");
  const funscripts = {};
  for (const entry of Array.isArray(input.funscripts) ? input.funscripts : []) {
    const difficulty = DIFFICULTIES.has(entry.difficulty) ? entry.difficulty : "default";
    if (entry.filename) funscripts[difficulty] = path.basename(entry.filename);
  }
  return {
    schemaVersion: 1,
    id,
    title: String(input.title || id || "Vidéo locale").trim(),
    type: VIDEO_TYPES.has(input.type) ? input.type : "normal",
    durationSeconds: Math.max(0, Number(input.durationSeconds) || 0),
    difficulties: Object.keys(funscripts),
    themes: normalizeTags(input.themes),
    performers: normalizeTags(input.performers),
    enabled: input.enabled !== false,
    weight: Math.max(0.01, Number(input.weight) || 1),
    allowRepeatInSameRun: input.allowRepeatInSameRun === true,
    videoFile: path.basename(String(input.videoFile || "video.mp4")),
    funscripts,
    ...(input.thumbnailFile ? { thumbnailFile: path.basename(String(input.thumbnailFile)) } : {}),
    ...(input.type === "event" ? {
      requiresVictory: input.requiresVictory === true,
      grantsEncounterReward: input.grantsEncounterReward === true,
      canEndRun: input.canEndRun === true
    } : {})
  };
}

function buildImageMetadata(input = {}) {
  const id = normalizeId(input.id || input.title || "image");
  return {
    schemaVersion: 1,
    id,
    title: String(input.title || id || "Image locale").trim(),
    type: IMAGE_TYPES.has(input.type) ? input.type : "special",
    themes: normalizeTags(input.themes),
    performers: normalizeTags(input.performers),
    imageFile: path.basename(String(input.imageFile || "image.webp")),
    ...(input.thumbnailFile ? { thumbnailFile: path.basename(String(input.thumbnailFile)) } : {}),
    enabled: input.enabled !== false
  };
}

function chooseDifficulty(funscripts = {}, requested = "normal") {
  if (funscripts[requested]) return { requestedDifficulty: requested, selectedDifficulty: requested, fallbackUsed: false };
  const fallbackOrder = requested === "hard"
    ? ["normal", "easy", "default"]
    : requested === "easy"
      ? ["normal", "default", "hard"]
      : ["default", "easy", "hard"];
  const selectedDifficulty = fallbackOrder.find((difficulty) => funscripts[difficulty]) || Object.keys(funscripts)[0] || null;
  return { requestedDifficulty: requested, selectedDifficulty, fallbackUsed: selectedDifficulty !== requested };
}

module.exports = {
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_TYPES,
  IMAGE_TYPES,
  DIFFICULTIES,
  normalizeId,
  normalizeTags,
  isSafeRelativeFile,
  validateFunscriptData,
  validateMetadataShape,
  buildVideoMetadata,
  buildImageMetadata,
  chooseDifficulty
};
