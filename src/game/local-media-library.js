"use strict";

function normalizeEntry(entry = {}) {
  return {
    id: String(entry.id ?? ""),
    title: String(entry.title ?? entry.id ?? "Vidéo locale"),
    videoPath: entry.videoPath ?? null,
    funscriptPath: entry.funscriptPath ?? null,
    type: entry.type ?? "normal",
    difficulty: entry.difficulty ?? "normal",
    durationSeconds: Math.max(0, Number(entry.durationSeconds) || 0),
    sizeBytes: Math.max(0, Number(entry.sizeBytes) || 0),
    modifiedAt: Number(entry.modifiedAt) || 0
  };
}

export class LocalMediaLibrary {
  constructor({ recentLimit = 4, random = Math.random } = {}) {
    this.recentLimit = Math.max(1, Number(recentLimit) || 4);
    this.random = random;
    this.entries = [];
    this.recentIds = [];
    this.directoryPath = null;
    this.missing = false;
  }

  loadScan(scan = {}) {
    this.directoryPath = scan.directoryPath ?? null;
    this.missing = scan.missing === true;
    this.entries = (scan.entries ?? []).map(normalizeEntry).filter((entry) => entry.id && entry.videoPath);
    return this.getDiagnostics();
  }

  getDiagnostics() {
    const withoutFunscript = this.entries.filter((entry) => !entry.funscriptPath).map((entry) => entry.id);
    return {
      directoryPath: this.directoryPath,
      missingDirectory: this.missing,
      videoCount: this.entries.length,
      withoutFunscript,
      readyCount: this.entries.length - withoutFunscript.length
    };
  }

  getCandidates({ type = null, difficulty = null, requireFunscript = true } = {}) {
    return this.entries.filter((entry) => {
      if (type && entry.type !== type) return false;
      if (difficulty && entry.difficulty !== difficulty) return false;
      if (requireFunscript && !entry.funscriptPath) return false;
      return true;
    });
  }

  select(options = {}) {
    const candidates = this.getCandidates(options);
    if (!candidates.length) return null;
    const fresh = candidates.filter((entry) => !this.recentIds.includes(entry.id));
    const pool = fresh.length ? fresh : candidates;
    const selected = pool[Math.floor(this.random() * pool.length)] ?? null;
    if (selected) {
      this.recentIds = [selected.id, ...this.recentIds.filter((id) => id !== selected.id)].slice(0, this.recentLimit);
    }
    return selected;
  }

  markUnavailable(entryId) {
    this.entries = this.entries.filter((entry) => entry.id !== entryId);
    this.recentIds = this.recentIds.filter((id) => id !== entryId);
  }
}

export async function scanLocalMediaLibrary() {
  if (!globalThis.chv1Media?.scanLibrary) return { directoryPath:null, entries:[], missing:true, unavailable:true };
  try { return await globalThis.chv1Media.scanLibrary(); }
  catch (error) { return { directoryPath:null, entries:[], missing:true, error:String(error?.message ?? error) }; }
}
