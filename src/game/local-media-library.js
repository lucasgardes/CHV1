"use strict";

function normalizeEntry(entry = {}) {
  const funscripts = entry.funscripts && typeof entry.funscripts === "object"
    ? { ...entry.funscripts }
    : (entry.funscriptPath ? { default: entry.funscriptPath } : {});
  const difficulties = Array.isArray(entry.difficulties) && entry.difficulties.length
    ? [...entry.difficulties]
    : Object.keys(funscripts);
  return {
    id: String(entry.id ?? ""), title: String(entry.title ?? entry.id ?? "Vidéo locale"),
    videoPath: entry.videoPath ?? null, funscripts, difficulties,
    type: entry.type ?? "normal", durationSeconds: Math.max(0, Number(entry.durationSeconds) || 0),
    themes: Array.isArray(entry.themes) ? [...entry.themes] : [],
    performers: Array.isArray(entry.performers) ? [...entry.performers] : [],
    enabled: entry.enabled !== false, available: entry.available !== false,
    weight: Math.max(0.01, Number(entry.weight) || 1),
    allowRepeatInSameRun: entry.allowRepeatInSameRun === true,
    sizeBytes: Math.max(0, Number(entry.sizeBytes) || 0), modifiedAt: Number(entry.modifiedAt) || 0
  };
}

function nearestDifficulty(available, requested) {
  if (!requested || available.includes(requested)) return requested || available[0] || null;
  const order = ["easy", "normal", "medium", "hard"];
  const index = order.indexOf(requested);
  return [...available].sort((left, right) => Math.abs(order.indexOf(left) - index) - Math.abs(order.indexOf(right) - index))[0] ?? available[0] ?? null;
}

export class LocalMediaLibrary {
  constructor({ recentLimit = 4, random = Math.random } = {}) {
    this.recentLimit = Math.max(1, Number(recentLimit) || 4); this.random = random;
    this.entries = []; this.recentIds = []; this.runIds = []; this.directoryPath = null; this.missing = false;
  }
  loadScan(scan = {}) {
    this.directoryPath = scan.directoryPath ?? null; this.missing = scan.missing === true;
    this.entries = (scan.videos ?? scan.entries ?? []).map(normalizeEntry).filter((entry) => entry.id && entry.videoPath && entry.enabled && entry.available);
    return this.getDiagnostics();
  }
  getDiagnostics() {
    const withoutFunscript = this.entries.filter((entry) => !Object.keys(entry.funscripts).length).map((entry) => entry.id);
    return { directoryPath:this.directoryPath, missingDirectory:this.missing, videoCount:this.entries.length, withoutFunscript, readyCount:this.entries.length-withoutFunscript.length };
  }
  getCandidates({ type = null, difficulty = null, excludedIds = [], excludedThemes = [], requireFunscript = true } = {}) {
    return this.entries.filter((entry) => {
      if (type && entry.type !== type) return false;
      if (excludedIds.includes(entry.id)) return false;
      if (excludedThemes.some((theme) => entry.themes.includes(theme))) return false;
      if (requireFunscript && !Object.keys(entry.funscripts).length) return false;
      if (difficulty && !entry.difficulties.includes(difficulty)) return false;
      return true;
    });
  }
  weightedPick(candidates) {
    const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = this.random() * total;
    for (const entry of candidates) { cursor -= entry.weight; if (cursor <= 0) return entry; }
    return candidates[candidates.length - 1] ?? null;
  }
  select(options = {}) {
    let candidates = this.getCandidates(options);
    let fallbackUsed = false;
    if (!candidates.length && options.difficulty) {
      candidates = this.getCandidates({ ...options, difficulty:null });
      fallbackUsed = candidates.length > 0;
    }
    if (!candidates.length) return null;
    const fresh = candidates.filter((entry) => !this.recentIds.includes(entry.id) && (!this.runIds.includes(entry.id) || entry.allowRepeatInSameRun));
    const pool = fresh.length ? fresh : candidates;
    const selected = this.weightedPick(pool);
    if (!selected) return null;
    this.recentIds = [selected.id, ...this.recentIds.filter((id) => id !== selected.id)].slice(0, this.recentLimit);
    if (!this.runIds.includes(selected.id)) this.runIds.push(selected.id);
    const selectedDifficulty = nearestDifficulty(selected.difficulties, options.difficulty);
    return {
      ...selected,
      requestedDifficulty: options.difficulty ?? null,
      selectedDifficulty,
      fallbackUsed: fallbackUsed || selectedDifficulty !== options.difficulty,
      funscriptPath: selected.funscripts[selectedDifficulty] ?? selected.funscripts.default ?? Object.values(selected.funscripts)[0] ?? null
    };
  }
  resetRunHistory() { this.runIds = []; }
  markUnavailable(entryId) { this.entries = this.entries.filter((entry) => entry.id !== entryId); this.recentIds = this.recentIds.filter((id) => id !== entryId); this.runIds = this.runIds.filter((id) => id !== entryId); }
}

const sharedLibrary = new LocalMediaLibrary();
export function getLocalMediaLibrary() { return sharedLibrary; }
export async function scanLocalMediaLibrary() {
  if (!globalThis.chv1Media?.scanLibrary) return { directoryPath:null, videos:[], images:[], entries:[], missing:true, unavailable:true };
  try { return await globalThis.chv1Media.scanLibrary(); }
  catch (error) { return { directoryPath:null, videos:[], images:[], entries:[], missing:true, error:String(error?.message ?? error) }; }
}
