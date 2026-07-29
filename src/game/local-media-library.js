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

const DIFFICULTY_ORDER = Object.freeze(["warmup", "easy", "normal", "medium", "hard", "boss"]);

function nearestDifficulty(available, requested) {
  if (!requested || available.includes(requested)) return requested || available[0] || null;
  const index = DIFFICULTY_ORDER.indexOf(requested);
  return [...available].sort((left, right) => Math.abs(DIFFICULTY_ORDER.indexOf(left) - index) - Math.abs(DIFFICULTY_ORDER.indexOf(right) - index))[0] ?? available[0] ?? null;
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
  prepareSelection(selected, requestedDifficulty = null, fallbackUsed = false) {
    if (!selected) return null;
    const selectedDifficulty = selected.type || nearestDifficulty(selected.difficulties, requestedDifficulty);
    return {
      ...selected,
      requestedDifficulty: requestedDifficulty ?? selectedDifficulty,
      selectedDifficulty,
      fallbackUsed,
      funscriptPath: selected.funscripts[selectedDifficulty] ?? selected.funscripts.default ?? Object.values(selected.funscripts)[0] ?? null
    };
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
    return this.prepareSelection(selected, options.difficulty, fallbackUsed);
  }
  selectDirectorAlternative({ difficulty = "normal", currentId = null, playedIds = [] } = {}) {
    const played = new Set(playedIds.map(String));
    const eligible = this.entries.filter((entry) => entry.id !== currentId && Object.keys(entry.funscripts).length > 0);
    if (!eligible.length) return null;
    const currentIndex = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
    const atLevel = (level, alreadyPlayed) => eligible.filter((entry) => entry.type === level && played.has(entry.id) === alreadyPlayed);

    let pool = atLevel(difficulty, false);
    let selectedDifficulty = difficulty;
    let fallbackUsed = false;

    if (!pool.length) {
      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        pool = atLevel(DIFFICULTY_ORDER[index], false);
        if (pool.length) { selectedDifficulty = DIFFICULTY_ORDER[index]; fallbackUsed = true; break; }
      }
    }
    if (!pool.length) {
      for (let index = currentIndex + 1; index < DIFFICULTY_ORDER.length; index += 1) {
        pool = atLevel(DIFFICULTY_ORDER[index], false);
        if (pool.length) { selectedDifficulty = DIFFICULTY_ORDER[index]; fallbackUsed = true; break; }
      }
    }
    if (!pool.length) {
      pool = atLevel(difficulty, true);
      selectedDifficulty = difficulty;
    }
    return this.prepareSelection(this.weightedPick(pool), selectedDifficulty, fallbackUsed);
  }
  resetRunHistory() { this.runIds = []; }
  markUnavailable(entryId) { this.entries = this.entries.filter((entry) => entry.id !== entryId); this.recentIds = this.recentIds.filter((id) => id !== entryId); this.runIds = this.runIds.filter((id) => id !== entryId); }
}

const sharedLibrary = new LocalMediaLibrary();
export function getLocalMediaLibrary() { return sharedLibrary; }
export async function scanLocalMediaLibrary() {
  if (!globalThis.chv1Media?.scanLibrary) return { directoryPath:null, videos:[], images:[], entries:[], missing:true, unavailable:true };
  try {
    const scanOptions = { force:true, cacheBust:`startup-${Date.now()}-${Math.random()}` };
    let scan = await globalThis.chv1Media.scanLibrary(scanOptions);
    if (scan?.cacheUsed === true) {
      scan = await globalThis.chv1Media.scanLibrary({ ...scanOptions, cacheBust:`retry-${Date.now()}-${Math.random()}` });
    }
    return { ...scan, cacheUsed:false };
  } catch (error) {
    return { directoryPath:null, videos:[], images:[], entries:[], missing:true, error:String(error?.message ?? error) };
  }
}
