"use strict";

import {
  ARCHIVE_TIERS,
  ARCHIVES,
  getArchiveById,
  getArchivesForLevelAndTier
} from "../data/archives.js";
import { LocalSaveService } from "./local-save.js";

export const SECRET_ARCHIVE_UNLOCK = "archive-route-secret-video";

export function getArchiveTierForRow(row, totalRows = 13) {
  const normalizedRow = Math.max(0, Number(row) || 0);
  const playableRows = Math.max(3, Number(totalRows) - 1 || 12);
  const progress = normalizedRow / playableRows;
  if (progress < 1 / 3) return ARCHIVE_TIERS.EARLY;
  if (progress < 2 / 3) return ARCHIVE_TIERS.MIDDLE;
  return ARCHIVE_TIERS.LATE;
}

export class ArchiveService {
  constructor({ gameState, saveService = new LocalSaveService(), random = Math.random }) {
    if (!gameState) throw new Error("L’état de partie est requis.");
    this.gameState = gameState;
    this.saveService = saveService;
    this.random = random;
  }

  getMeta() {
    return this.saveService.load();
  }

  getDiscovered() {
    return this.getMeta().discoveredArchives.map(getArchiveById).filter(Boolean);
  }

  getArchivePool({ level = 1, row = 0, totalRows = 13 } = {}) {
    const tier = getArchiveTierForRow(row, totalRows);
    return {
      tier,
      archives: getArchivesForLevelAndTier(level, tier)
    };
  }

  getNextArchive(context = {}) {
    const { archives } = this.getArchivePool(context);
    if (archives.length === 0) return null;

    const discovered = new Set(this.getMeta().discoveredArchives);
    const undiscovered = archives.filter((entry) => !discovered.has(entry.id));
    const candidates = undiscovered.length > 0 ? undiscovered : archives;
    const index = Math.min(
      candidates.length - 1,
      Math.floor(Math.max(0, Math.min(0.999999, this.random())) * candidates.length)
    );
    return candidates[index] ?? null;
  }

  discoverCurrentCampfire(node) {
    if (!node?.id) throw new Error("Le feu de camp courant est invalide.");

    const alreadyExplored = this.gameState.campfireNarrativeNodeIds?.includes(node.id);
    const context = {
      level: Number(node.level) || Number(this.gameState.currentLevel) || 1,
      row: Number(node.row) || 0,
      totalRows: Number(node.totalRows) || 13
    };
    const archive = this.getNextArchive(context);
    if (!archive) return null;
    if (alreadyExplored) return { archive, alreadyExplored: true };

    this.gameState.campfireNarrativeNodeIds.push(node.id);
    this.saveService.update((meta) => ({
      ...meta,
      discoveredArchives: [...new Set([...meta.discoveredArchives, archive.id])]
    }));

    return {
      archive,
      alreadyExplored: false,
      tier: archive.tier,
      level: archive.level
    };
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
      unlockedContent: [...new Set([
        ...current.unlockedContent,
        SECRET_ARCHIVE_UNLOCK,
        "archive-final-entry"
      ])]
    }));
    return { unlocked: true, progress, meta };
  }
}
