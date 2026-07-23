"use strict";

import { ARCHIVES, getArchiveById } from "../data/archives.js";
import { LocalSaveService } from "./local-save.js";

export const SECRET_ARCHIVE_UNLOCK = "archive-route-secret-video";

export class ArchiveService {
  constructor({ gameState, saveService = new LocalSaveService() }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.gameState = gameState;
    this.saveService = saveService;
  }

  getMeta() { return this.saveService.load(); }
  getDiscovered() { return this.getMeta().discoveredArchives.map(getArchiveById).filter(Boolean); }
  getNextArchive() {
    const discovered = new Set(this.getMeta().discoveredArchives);
    return ARCHIVES.find((entry) => !discovered.has(entry.id)) ?? ARCHIVES.at(-1) ?? null;
  }

  discoverCurrentCampfire(nodeId) {
    if (!nodeId) throw new Error("Le feu de camp courant est invalide.");
    const archive = this.getNextArchive();
    if (!archive) return null;
    const alreadyExplored = this.gameState.campfireNarrativeNodeIds?.includes(nodeId);
    if (alreadyExplored) return { archive, alreadyExplored: true };
    this.gameState.campfireNarrativeNodeIds.push(nodeId);
    this.saveService.update((meta) => ({
      ...meta,
      discoveredArchives: [...new Set([...meta.discoveredArchives, archive.id])]
    }));
    return { archive, alreadyExplored: false };
  }

  getCampfireProgress() {
    const explored = this.gameState.campfireNarrativeNodeIds?.length ?? 0;
    const encountered = this.gameState.campfiresEncountered ?? 0;
    return { explored, encountered, allExplored: encountered >= 2 && explored === encountered };
  }

  unlockSecretAfterBoss() {
    const progress = this.getCampfireProgress();
    if (!progress.allExplored) return { unlocked: false, progress };
    const meta = this.saveService.update((current) => ({
      ...current,
      unlockedContent: [...new Set([...current.unlockedContent, SECRET_ARCHIVE_UNLOCK, "archive-final-entry"])]
    }));
    return { unlocked: true, progress, meta };
  }
}
