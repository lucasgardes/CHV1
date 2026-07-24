const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_TYPES, IMAGE_TYPES,
  normalizeId, validateFunscriptData, validateMetadataShape,
  buildVideoMetadata, buildImageMetadata
} = require("./media/catalog.js");

let selectedLibraryPath = null;

async function fileExists(filePath) { try { await fs.access(filePath); return true; } catch { return false; } }
async function readJson(filePath, fallback = null) { try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return fallback; } }
async function writeJson(filePath, value) { await fs.mkdir(path.dirname(filePath), { recursive:true }); await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function isInside(rootPath, candidatePath) { const relative = path.relative(rootPath, candidatePath); return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)); }
function defaultLibraryPath() { return path.join(app.getPath("userData"), "media"); }
function libraryPath() { return selectedLibraryPath || defaultLibraryPath(); }
function settingsPath() { return path.join(app.getPath("userData"), "media-settings.json"); }
function cachePath() { return path.join(app.getPath("userData"), "library-cache.json"); }
function collectionPath() { return path.join(app.getPath("userData"), "collection.json"); }

async function loadSettings() {
  const settings = await readJson(settingsPath(), {});
  if (typeof settings.libraryPath === "string" && settings.libraryPath) selectedLibraryPath = settings.libraryPath;
}
async function saveSettings() { await writeJson(settingsPath(), { schemaVersion:1, libraryPath:libraryPath() }); }

async function walkForMetadata(rootPath) {
  const results = [];
  if (!(await fileExists(rootPath))) return results;
  const stack = [rootPath];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = await fs.readdir(current, { withFileTypes:true }); } catch { continue; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.toLowerCase() === "metadata.json") results.push(absolute);
    }
  }
  return results.sort();
}
async function signature(filePath) { try { const stat = await fs.stat(filePath); return `${stat.size}:${Math.trunc(stat.mtimeMs)}`; } catch { return "missing"; } }
async function validateFunscriptFile(filePath) { const data = await readJson(filePath, null); return validateFunscriptData(data); }

async function scanVideoMetadata(root, metadataPath, usedIds) {
  const folder = path.dirname(metadataPath);
  const metadata = await readJson(metadataPath, null);
  const errors = validateMetadataShape(metadata, "video");
  const id = String(metadata?.id ?? "").trim();
  if (id && usedIds.has(id)) errors.push("duplicate-id");

  const videoAbsolute = path.resolve(folder, String(metadata?.videoFile ?? ""));
  if (!isInside(root, videoAbsolute)) errors.push("video-outside-library");
  if (!(await fileExists(videoAbsolute))) errors.push("missing-video");

  const funscripts = {};
  const funscriptDiagnostics = {};
  for (const [difficulty, filename] of Object.entries(metadata?.funscripts ?? {})) {
    const absolute = path.resolve(folder, String(filename));
    if (!isInside(root, absolute)) { errors.push(`funscript-outside-library:${difficulty}`); continue; }
    if (!(await fileExists(absolute))) { errors.push(`missing-funscript:${difficulty}`); continue; }
    const validationErrors = await validateFunscriptFile(absolute);
    funscriptDiagnostics[difficulty] = validationErrors;
    if (validationErrors.length) { errors.push(...validationErrors.map((error) => `invalid-funscript:${difficulty}:${error}`)); continue; }
    funscripts[difficulty] = pathToFileURL(absolute).href;
  }

  const thumbnailAbsolute = metadata?.thumbnailFile ? path.resolve(folder, metadata.thumbnailFile) : null;
  if (thumbnailAbsolute && !isInside(root, thumbnailAbsolute)) errors.push("thumbnail-outside-library");
  if (metadata?.thumbnailFile && !(await fileExists(thumbnailAbsolute))) errors.push("missing-thumbnail");
  if (id) usedIds.add(id);

  return {
    kind:"video", id, title:String(metadata?.title ?? id ?? "Vidéo locale"), type:metadata?.type ?? "normal",
    durationSeconds:Math.max(0, Number(metadata?.durationSeconds) || 0), difficulties:Object.keys(funscripts),
    themes:Array.isArray(metadata?.themes) ? metadata.themes : [], performers:Array.isArray(metadata?.performers) ? metadata.performers : [],
    enabled:metadata?.enabled !== false, weight:Math.max(0.01, Number(metadata?.weight) || 1),
    allowRepeatInSameRun:metadata?.allowRepeatInSameRun === true,
    videoPath:await fileExists(videoAbsolute) ? pathToFileURL(videoAbsolute).href : null, funscripts,
    thumbnailPath:thumbnailAbsolute && await fileExists(thumbnailAbsolute) ? pathToFileURL(thumbnailAbsolute).href : null,
    metadataPath, available:errors.length === 0, errors:[...new Set(errors)],
    modifiedAt:(await fs.stat(metadataPath)).mtimeMs,
    sourceSignature:[await signature(metadataPath), await signature(videoAbsolute), ...await Promise.all(Object.values(metadata?.funscripts ?? {}).map((filename) => signature(path.resolve(folder, filename)))), thumbnailAbsolute ? await signature(thumbnailAbsolute) : ""].join("|"),
    funscriptDiagnostics,
    requiresVictory:metadata?.requiresVictory !== false, grantsEncounterReward:metadata?.grantsEncounterReward !== false, canEndRun:metadata?.canEndRun !== false
  };
}

async function scanImageMetadata(root, metadataPath, usedIds) {
  const folder = path.dirname(metadataPath);
  const metadata = await readJson(metadataPath, null);
  const errors = validateMetadataShape(metadata, "image");
  const id = String(metadata?.id ?? "").trim();
  if (id && usedIds.has(id)) errors.push("duplicate-id");
  const imageAbsolute = path.resolve(folder, String(metadata?.imageFile ?? ""));
  const thumbnailAbsolute = metadata?.thumbnailFile ? path.resolve(folder, metadata.thumbnailFile) : imageAbsolute;
  if (!isInside(root, imageAbsolute)) errors.push("image-outside-library");
  if (!isInside(root, thumbnailAbsolute)) errors.push("thumbnail-outside-library");
  if (!(await fileExists(imageAbsolute))) errors.push("missing-image");
  if (!(await fileExists(thumbnailAbsolute))) errors.push("missing-thumbnail");
  if (id) usedIds.add(id);
  return {
    kind:"image", id, title:String(metadata?.title ?? id ?? "Image locale"), type:metadata?.type ?? "special",
    themes:Array.isArray(metadata?.themes) ? metadata.themes : [], performers:Array.isArray(metadata?.performers) ? metadata.performers : [], enabled:metadata?.enabled !== false,
    imagePath:await fileExists(imageAbsolute) ? pathToFileURL(imageAbsolute).href : null,
    thumbnailPath:await fileExists(thumbnailAbsolute) ? pathToFileURL(thumbnailAbsolute).href : null,
    metadataPath, available:errors.length === 0, errors:[...new Set(errors)], modifiedAt:(await fs.stat(metadataPath)).mtimeMs,
    sourceSignature:[await signature(metadataPath), await signature(imageAbsolute), await signature(thumbnailAbsolute)].join("|")
  };
}

async function scanLegacyFlatDirectory(directoryPath) {
  const entries = [];
  if (!(await fileExists(directoryPath))) return entries;
  for (const entry of await fs.readdir(directoryPath, { withFileTypes:true })) {
    if (!entry.isFile() || !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const videoFilePath = path.join(directoryPath, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    const baseName = path.basename(entry.name, extension);
    const funscriptFilePath = path.join(directoryPath, `${baseName}.funscript`);
    const stat = await fs.stat(videoFilePath);
    const validationErrors = await validateFunscriptFile(funscriptFilePath);
    const hasFunscript = await fileExists(funscriptFilePath) && validationErrors.length === 0;
    entries.push({
      kind:"video", id:normalizeId(baseName), title:baseName.replace(/[-_]+/g, " "), type:"normal", durationSeconds:0,
      difficulties:hasFunscript ? ["default"] : [], themes:[], performers:[], enabled:true, weight:1, allowRepeatInSameRun:false,
      videoPath:pathToFileURL(videoFilePath).href, funscripts:hasFunscript ? { default:pathToFileURL(funscriptFilePath).href } : {}, thumbnailPath:null,
      available:hasFunscript, errors:hasFunscript ? [] : validationErrors.map((error) => `invalid-funscript:default:${error}`),
      sizeBytes:stat.size, modifiedAt:stat.mtimeMs, sourceSignature:`${stat.size}:${Math.trunc(stat.mtimeMs)}:${await signature(funscriptFilePath)}`
    });
  }
  return entries;
}

async function scanDirectory(directoryPath = libraryPath()) {
  if (!directoryPath || !(await fileExists(directoryPath))) return { schemaVersion:1, directoryPath, videos:[], images:[], entries:[], missing:true, errors:[], cacheUsed:false };
  const metadataFiles = await walkForMetadata(directoryPath);
  const usedIds = new Set(); const videos = []; const images = [];
  for (const metadataPath of metadataFiles) {
    const relative = path.relative(directoryPath, metadataPath).split(path.sep).map((part) => part.toLowerCase());
    const metadata = await readJson(metadataPath, {});
    const isImage = relative.includes("images") || Object.prototype.hasOwnProperty.call(metadata, "imageFile");
    const media = isImage ? await scanImageMetadata(directoryPath, metadataPath, usedIds) : await scanVideoMetadata(directoryPath, metadataPath, usedIds);
    (isImage ? images : videos).push(media);
  }
  if (!metadataFiles.length) videos.push(...await scanLegacyFlatDirectory(directoryPath));
  const catalog = {
    schemaVersion:1, directoryPath, videos, images, entries:videos, missing:false, scannedAt:new Date().toISOString(), cacheUsed:false,
    errors:[...videos, ...images].filter((entry) => entry.errors.length).map((entry) => ({ id:entry.id || path.basename(entry.metadataPath || "unknown"), kind:entry.kind, errors:entry.errors }))
  };
  await writeJson(cachePath(), catalog);
  return catalog;
}

async function ensureUniqueId(root, id) { const catalog = await scanDirectory(root); return ![...catalog.videos, ...catalog.images].some((entry) => entry.id === id); }
async function copyFile(source, destination) { await fs.mkdir(path.dirname(destination), { recursive:true }); await fs.copyFile(source, destination); }

async function importVideo(payload = {}) {
  const root = libraryPath(); const sourceVideo = String(payload.sourceVideo ?? "");
  if (!(await fileExists(sourceVideo))) throw new Error("La vidéo sélectionnée est introuvable.");
  if (!VIDEO_EXTENSIONS.has(path.extname(sourceVideo).toLowerCase())) throw new Error("Format vidéo non pris en charge. Utilise MP4 ou WebM.");
  const id = normalizeId(payload.id || payload.title || path.basename(sourceVideo, path.extname(sourceVideo)));
  if (!id) throw new Error("Impossible de générer un identifiant valide.");
  if (!(await ensureUniqueId(root, id))) throw new Error(`L'identifiant ${id} existe déjà.`);
  const sourceFunscripts = Array.isArray(payload.funscripts) ? payload.funscripts : [];
  if (!sourceFunscripts.length) throw new Error("Au moins un funscript est obligatoire.");
  const validated = [];
  for (const entry of sourceFunscripts) {
    if (!(await fileExists(entry.path))) throw new Error(`Funscript introuvable : ${entry.path}`);
    const errors = await validateFunscriptFile(entry.path);
    if (errors.length) throw new Error(`Funscript invalide (${entry.difficulty || "default"}) : ${errors.join(", ")}`);
    const difficulty = ["easy", "normal", "hard", "default"].includes(entry.difficulty) ? entry.difficulty : "default";
    if (validated.some((item) => item.difficulty === difficulty)) throw new Error(`La difficulté ${difficulty} est déclarée plusieurs fois.`);
    validated.push({ difficulty, source:entry.path, filename:`${difficulty}.funscript` });
  }
  const type = VIDEO_TYPES.has(payload.type) ? payload.type : "normal";
  const destination = path.join(root, "videos", type, id);
  if (await fileExists(destination)) throw new Error("Le dossier de destination existe déjà.");
  await fs.mkdir(destination, { recursive:true });
  try {
    const videoFilename = `video${path.extname(sourceVideo).toLowerCase()}`;
    await copyFile(sourceVideo, path.join(destination, videoFilename));
    for (const entry of validated) await copyFile(entry.source, path.join(destination, entry.filename));
    let thumbnailFile;
    if (payload.thumbnailPath && await fileExists(payload.thumbnailPath)) {
      thumbnailFile = `thumbnail${path.extname(payload.thumbnailPath).toLowerCase()}`;
      await copyFile(payload.thumbnailPath, path.join(destination, thumbnailFile));
    }
    const metadata = buildVideoMetadata({ ...payload, id, type, videoFile:videoFilename, thumbnailFile, funscripts:validated.map(({ difficulty, filename }) => ({ difficulty, filename })) });
    const shapeErrors = validateMetadataShape(metadata, "video");
    if (shapeErrors.length) throw new Error(`Métadonnées invalides : ${shapeErrors.join(", ")}`);
    await writeJson(path.join(destination, "metadata.json"), metadata);
    return { imported:true, id, destination, catalog:await scanDirectory(root) };
  } catch (error) { await fs.rm(destination, { recursive:true, force:true }); throw error; }
}

async function importImage(payload = {}) {
  const root = libraryPath(); const sourceImage = String(payload.sourceImage ?? "");
  if (!(await fileExists(sourceImage))) throw new Error("L'image sélectionnée est introuvable.");
  if (!IMAGE_EXTENSIONS.has(path.extname(sourceImage).toLowerCase())) throw new Error("Format d'image non pris en charge.");
  const id = normalizeId(payload.id || payload.title || path.basename(sourceImage, path.extname(sourceImage)));
  if (!id) throw new Error("Impossible de générer un identifiant valide.");
  if (!(await ensureUniqueId(root, id))) throw new Error(`L'identifiant ${id} existe déjà.`);
  const type = IMAGE_TYPES.has(payload.type) ? payload.type : "special";
  const destination = path.join(root, "images", type, id);
  await fs.mkdir(destination, { recursive:true });
  try {
    const imageFilename = `image${path.extname(sourceImage).toLowerCase()}`;
    await copyFile(sourceImage, path.join(destination, imageFilename));
    let thumbnailFile;
    if (payload.thumbnailPath && await fileExists(payload.thumbnailPath)) {
      thumbnailFile = `thumbnail${path.extname(payload.thumbnailPath).toLowerCase()}`;
      await copyFile(payload.thumbnailPath, path.join(destination, thumbnailFile));
    }
    const metadata = buildImageMetadata({ ...payload, id, type, imageFile:imageFilename, thumbnailFile });
    const shapeErrors = validateMetadataShape(metadata, "image");
    if (shapeErrors.length) throw new Error(`Métadonnées invalides : ${shapeErrors.join(", ")}`);
    await writeJson(path.join(destination, "metadata.json"), metadata);
    return { imported:true, id, destination, catalog:await scanDirectory(root) };
  } catch (error) { await fs.rm(destination, { recursive:true, force:true }); throw error; }
}

async function chooseImportFiles(kind) {
  const isImage = kind === "image";
  const primary = await dialog.showOpenDialog({ properties:["openFile"], filters:isImage ? [{ name:"Images", extensions:[...IMAGE_EXTENSIONS].map((value) => value.slice(1)) }] : [{ name:"Vidéos", extensions:[...VIDEO_EXTENSIONS].map((value) => value.slice(1)) }] });
  if (primary.canceled || !primary.filePaths[0]) return { canceled:true };
  if (isImage) return { canceled:false, sourceImage:primary.filePaths[0] };
  const scripts = await dialog.showOpenDialog({ properties:["openFile", "multiSelections"], filters:[{ name:"Funscripts", extensions:["funscript"] }] });
  if (scripts.canceled || !scripts.filePaths.length) return { canceled:true };
  return { canceled:false, sourceVideo:primary.filePaths[0], funscriptPaths:scripts.filePaths };
}

async function readCollection() { return await readJson(collectionPath(), { schemaVersion:1, videos:{}, images:{} }); }
async function updateCollection(update = {}) {
  const collection = await readCollection();
  if (update.kind === "video" && update.id) collection.videos[update.id] = { ...(collection.videos[update.id] ?? {}), ...update.patch };
  if (update.kind === "image" && update.id) collection.images[update.id] = { ...(collection.images[update.id] ?? {}), ...update.patch };
  await writeJson(collectionPath(), collection); return collection;
}

ipcMain.handle("media:scan-library", async () => scanDirectory());
ipcMain.handle("media:choose-library", async () => {
  const result = await dialog.showOpenDialog({ properties:["openDirectory", "createDirectory"] });
  if (result.canceled || !result.filePaths[0]) return { canceled:true };
  selectedLibraryPath = result.filePaths[0]; await saveSettings();
  return { canceled:false, ...(await scanDirectory()) };
});
ipcMain.handle("media:get-library-path", async () => libraryPath());
ipcMain.handle("media:choose-import-files", (_event, kind) => chooseImportFiles(kind));
ipcMain.handle("media:import-video", (_event, payload) => importVideo(payload));
ipcMain.handle("media:import-image", (_event, payload) => importImage(payload));
ipcMain.handle("collection:get", readCollection);
ipcMain.handle("collection:update", (_event, update) => updateCollection(update));

function createWindow() {
  const mainWindow = new BrowserWindow({ width:1280, height:720, minWidth:900, minHeight:600, backgroundColor:"#111111", webPreferences:{ contextIsolation:true, nodeIntegration:false, preload:path.join(__dirname, "preload.js") } });
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}
app.whenReady().then(async () => { await loadSettings(); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
