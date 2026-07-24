"use strict";

const VIDEO_TYPES = ["normal", "elite", "boss", "event", "secret"];
const IMAGE_TYPES = ["event", "performer", "secret", "special"];
const DIFFICULTIES = ["easy", "normal", "hard", "default"];

function ask(label, fallback = "") { const value = window.prompt(label, fallback); return value == null ? null : value.trim(); }
function splitTags(value) { return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean); }
function inferDifficulty(filePath, index, total) { const name = String(filePath).toLowerCase(); const found = DIFFICULTIES.find((difficulty) => name.includes(difficulty)); if (found) return found; if (total === 1) return "default"; return DIFFICULTIES[Math.min(index, DIFFICULTIES.length - 1)]; }
function basenameWithoutExtension(filePath) { const filename = String(filePath).split(/[\\/]/).pop() || "media"; return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); }
function setStatus(message, isError = false) { const status = document.getElementById("media-import-status"); if (!status) return; status.textContent = message; status.classList.toggle("is-error", isError); }
async function refreshCollection(catalog) { window.dispatchEvent(new CustomEvent("chv1:media-catalog-updated", { detail:catalog })); window.location.reload(); }

async function inspectImportedVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata"; video.muted = true; video.playsInline = true; video.src = videoPath;
    const cleanup = () => { video.removeAttribute("src"); video.load(); };
    video.addEventListener("error", () => { cleanup(); reject(new Error("Impossible de lire les métadonnées de la vidéo importée.")); }, { once:true });
    video.addEventListener("loadedmetadata", () => {
      const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      const captureAt = Math.min(Math.max(0, durationSeconds * 0.1), Math.max(0, durationSeconds - 0.1));
      const capture = () => {
        try {
          const width = Math.max(1, video.videoWidth || 640); const height = Math.max(1, video.videoHeight || 360);
          const canvas = document.createElement("canvas"); const targetWidth = Math.min(640, width); canvas.width = targetWidth; canvas.height = Math.max(1, Math.round(height * targetWidth / width));
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.82); cleanup(); resolve({ durationSeconds, thumbnailDataUrl });
        } catch (error) { cleanup(); resolve({ durationSeconds, thumbnailDataUrl:null }); }
      };
      if (captureAt > 0) { video.addEventListener("seeked", capture, { once:true }); video.currentTime = captureAt; } else { video.addEventListener("loadeddata", capture, { once:true }); }
    }, { once:true });
  });
}

async function importVideo() {
  setStatus("Sélection de la vidéo et des funscripts…");
  const selection = await globalThis.chv1Media.chooseImportFiles("video");
  if (selection?.canceled) { setStatus("Import annulé."); return; }
  const guessedTitle = basenameWithoutExtension(selection.sourceVideo);
  const title = ask("Titre affiché de la vidéo :", guessedTitle); if (title == null) return setStatus("Import annulé.");
  const id = ask("Identifiant permanent (laisser vide pour le générer depuis le titre) :", ""); if (id == null) return setStatus("Import annulé.");
  const type = ask(`Type (${VIDEO_TYPES.join(", ")}) :`, "normal"); if (type == null) return setStatus("Import annulé.");
  const performers = ask("Performers, séparés par des virgules :", ""); if (performers == null) return setStatus("Import annulé.");
  const themes = ask("Thèmes, séparés par des virgules :", ""); if (themes == null) return setStatus("Import annulé.");
  const funscripts = [];
  for (const [index, filePath] of selection.funscriptPaths.entries()) { const inferred = inferDifficulty(filePath, index, selection.funscriptPaths.length); const difficulty = ask(`Difficulté pour ${filePath.split(/[\\/]/).pop()} :`, inferred); if (difficulty == null) return setStatus("Import annulé."); funscripts.push({ path:filePath, difficulty }); }
  setStatus("Validation et copie des fichiers…");
  try {
    const result = await globalThis.chv1Media.importVideo({ sourceVideo:selection.sourceVideo, id, title, type, durationSeconds:0, performers:splitTags(performers), themes:splitTags(themes), enabled:true, weight:1, allowRepeatInSameRun:false, funscripts });
    setStatus("Détection de la durée et création de la miniature…");
    const inspection = await inspectImportedVideo(result.videoPath);
    const finalized = await globalThis.chv1Media.finalizeVideoImport({ id:result.id, ...inspection });
    setStatus(`Vidéo importée : ${result.id}`); await refreshCollection(finalized.catalog);
  } catch (error) { setStatus(error?.message || "Échec de l'import vidéo.", true); }
}

async function importImage() {
  setStatus("Sélection de l’image…"); const selection = await globalThis.chv1Media.chooseImportFiles("image"); if (selection?.canceled) { setStatus("Import annulé."); return; }
  const guessedTitle = basenameWithoutExtension(selection.sourceImage); const title = ask("Titre affiché de l’image :", guessedTitle); if (title == null) return setStatus("Import annulé.");
  const id = ask("Identifiant permanent (laisser vide pour le générer depuis le titre) :", ""); if (id == null) return setStatus("Import annulé.");
  const type = ask(`Type (${IMAGE_TYPES.join(", ")}) :`, "special"); if (type == null) return setStatus("Import annulé.");
  const performers = ask("Performers, séparés par des virgules :", ""); if (performers == null) return setStatus("Import annulé.");
  const themes = ask("Thèmes, séparés par des virgules :", ""); if (themes == null) return setStatus("Import annulé.");
  setStatus("Validation et copie de l’image…");
  try { const result = await globalThis.chv1Media.importImage({ sourceImage:selection.sourceImage, id, title, type, performers:splitTags(performers), themes:splitTags(themes), enabled:true }); setStatus(`Image importée : ${result.id}`); await refreshCollection(result.catalog); } catch (error) { setStatus(error?.message || "Échec de l'import image.", true); }
}

async function chooseLibrary() { setStatus("Sélection du dossier de bibliothèque…"); const result = await globalThis.chv1Media.chooseLibrary(); if (result?.canceled) return setStatus("Sélection annulée."); setStatus(`Bibliothèque active : ${result.directoryPath}`); await refreshCollection(result); }

async function initializePrivacySetting() {
  const panel = document.querySelector(".settings-dialog"); if (!panel || document.getElementById("retain-detailed-history")) return;
  const settings = await globalThis.chv1Media.getSettings(); const label = document.createElement("label"); label.className = "address-field";
  const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.id = "retain-detailed-history"; checkbox.checked = settings.retainDetailedHistory !== false;
  const text = document.createElement("span"); text.textContent = "Conserver l’historique détaillé des vidéos";
  checkbox.addEventListener("change", () => void globalThis.chv1Media.updateSettings({ retainDetailedHistory:checkbox.checked }));
  label.append(text, checkbox); panel.append(label);
}

function initializeImportUi() {
  if (!globalThis.chv1Media) return; const header = document.querySelector(".collection-header"); if (!header || document.getElementById("media-import-actions")) return;
  const wrapper = document.createElement("div"); wrapper.id = "media-import-actions"; wrapper.className = "media-import-actions";
  const choose = document.createElement("button"); choose.type = "button"; choose.textContent = "Dossier média"; choose.addEventListener("click", chooseLibrary);
  const video = document.createElement("button"); video.type = "button"; video.textContent = "Importer une vidéo"; video.addEventListener("click", importVideo);
  const image = document.createElement("button"); image.type = "button"; image.textContent = "Importer une image"; image.addEventListener("click", importImage);
  const status = document.createElement("span"); status.id = "media-import-status";
  wrapper.append(choose, video, image, status); header.append(wrapper); void initializePrivacySetting();
}

window.addEventListener("DOMContentLoaded", initializeImportUi);
