const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mkv", ".mov"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VALID_VIDEO_TYPES = new Set(["normal", "elite", "boss", "event", "secret"]);
const VALID_IMAGE_TYPES = new Set(["event", "performer", "secret", "special"]);
let selectedLibraryPath = null;

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return fallback; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isInside(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function walkForMetadata(rootPath) {
  const results = [];
  if (!(await fileExists(rootPath))) return results;
  const stack = [rootPath];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.toLowerCase() === "metadata.json") results.push(absolute);
    }
  }
  return results;
}

function normalizeTags(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
}

async function scanVideoMetadata(libraryRoot, metadataPath, usedIds) {
  const folder = path.dirname(metadataPath);
  const metadata = await readJson(metadataPath, {});
  const id = String(metadata.id ?? "").trim();
  const errors = [];
  if (!id) errors.push("missing-id");
  if (usedIds.has(id)) errors.push("duplicate-id");
  const type = VALID_VIDEO_TYPES.has(metadata.type) ? metadata.type : "normal";
  if (!VALID_VIDEO_TYPES.has(metadata.type)) errors.push("invalid-type");
  const videoFile = String(metadata.videoFile ?? "video.mp4");
  const videoAbsolute = path.resolve(folder, videoFile);
  if (!isInside(libraryRoot, videoAbsolute)) errors.push("video-outside-library");
  if (!(await fileExists(videoAbsolute))) errors.push("missing-video");
  if (!VIDEO_EXTENSIONS.has(path.extname(videoAbsolute).toLowerCase())) errors.push("unsupported-video-format");

  const declared = metadata.funscripts && typeof metadata.funscripts === "object" ? metadata.funscripts : {};
  const funscripts = {};
  for (const [difficulty, filename] of Object.entries(declared)) {
    const absolute = path.resolve(folder, String(filename));
    if (!isInside(libraryRoot, absolute)) { errors.push(`funscript-outside-library:${difficulty}`); continue; }
    const parsed = await readJson(absolute, null);
    if (!parsed || !Array.isArray(parsed.actions)) { errors.push(`invalid-funscript:${difficulty}`); continue; }
    funscripts[difficulty] = pathToFileURL(absolute).href;
  }
  if (!Object.keys(funscripts).length) {
    const defaultPath = path.join(folder, "default.funscript");
    const parsed = await readJson(defaultPath, null);
    if (parsed && Array.isArray(parsed.actions)) funscripts.default = pathToFileURL(defaultPath).href;
  }
  if (!Object.keys(funscripts).length) errors.push("missing-funscript");

  const thumbnailAbsolute = metadata.thumbnailFile ? path.resolve(folder, String(metadata.thumbnailFile)) : null;
  if (id) usedIds.add(id);
  return {
    kind: "video", id, title: String(metadata.title ?? id ?? "Vidéo locale"), type,
    durationSeconds: Math.max(0, Number(metadata.durationSeconds) || 0),
    difficulties: Object.keys(funscripts), themes: normalizeTags(metadata.themes),
    performers: normalizeTags(metadata.performers), enabled: metadata.enabled !== false,
    weight: Math.max(0.01, Number(metadata.weight) || 1),
    allowRepeatInSameRun: metadata.allowRepeatInSameRun === true,
    videoPath: errors.includes("missing-video") ? null : pathToFileURL(videoAbsolute).href,
    funscripts,
    thumbnailPath: thumbnailAbsolute && await fileExists(thumbnailAbsolute) ? pathToFileURL(thumbnailAbsolute).href : null,
    metadataPath, available: errors.length === 0, errors,
    modifiedAt: (await fs.stat(metadataPath)).mtimeMs,
    requiresVictory: metadata.requiresVictory !== false,
    grantsEncounterReward: metadata.grantsEncounterReward !== false,
    canEndRun: metadata.canEndRun !== false
  };
}

async function scanImageMetadata(libraryRoot, metadataPath, usedIds) {
  const folder = path.dirname(metadataPath);
  const metadata = await readJson(metadataPath, {});
  const id = String(metadata.id ?? "").trim();
  const errors = [];
  if (!id) errors.push("missing-id");
  if (usedIds.has(id)) errors.push("duplicate-id");
  const type = VALID_IMAGE_TYPES.has(metadata.type) ? metadata.type : "special";
  if (!VALID_IMAGE_TYPES.has(metadata.type)) errors.push("invalid-type");
  const imageAbsolute = path.resolve(folder, String(metadata.imageFile ?? "image.webp"));
  if (!isInside(libraryRoot, imageAbsolute)) errors.push("image-outside-library");
  if (!(await fileExists(imageAbsolute))) errors.push("missing-image");
  if (!IMAGE_EXTENSIONS.has(path.extname(imageAbsolute).toLowerCase())) errors.push("unsupported-image-format");
  const thumbnailAbsolute = metadata.thumbnailFile ? path.resolve(folder, String(metadata.thumbnailFile)) : imageAbsolute;
  if (id) usedIds.add(id);
  return {
    kind: "image", id, title: String(metadata.title ?? id ?? "Image locale"), type,
    themes: normalizeTags(metadata.themes), performers: normalizeTags(metadata.performers),
    enabled: metadata.enabled !== false,
    imagePath: errors.includes("missing-image") ? null : pathToFileURL(imageAbsolute).href,
    thumbnailPath: await fileExists(thumbnailAbsolute) ? pathToFileURL(thumbnailAbsolute).href : null,
    metadataPath, available: errors.length === 0, errors,
    modifiedAt: (await fs.stat(metadataPath)).mtimeMs
  };
}

async function scanLegacyFlatDirectory(directoryPath) {
  const entries = [];
  if (!(await fileExists(directoryPath))) return entries;
  for (const entry of await fs.readdir(directoryPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension)) continue;
    const videoFilePath = path.join(directoryPath, entry.name);
    const baseName = path.basename(entry.name, extension);
    const funscriptFilePath = path.join(directoryPath, `${baseName}.funscript`);
    const stat = await fs.stat(videoFilePath);
    const hasFunscript = await fileExists(funscriptFilePath);
    entries.push({
      kind: "video", id: baseName, title: baseName.replace(/[-_]+/g, " "), type: "normal",
      durationSeconds: 0, difficulties: hasFunscript ? ["default"] : [], themes: [], performers: [],
      enabled: true, weight: 1, allowRepeatInSameRun: false,
      videoPath: pathToFileURL(videoFilePath).href,
      funscripts: hasFunscript ? { default: pathToFileURL(funscriptFilePath).href } : {},
      thumbnailPath: null, available: hasFunscript, errors: hasFunscript ? [] : ["missing-funscript"],
      sizeBytes: stat.size, modifiedAt: stat.mtimeMs
    });
  }
  return entries;
}

async function scanDirectory(directoryPath) {
  if (!directoryPath || !(await fileExists(directoryPath))) return { directoryPath, videos: [], images: [], entries: [], missing: true, errors: [] };
  const metadataFiles = await walkForMetadata(directoryPath);
  const usedIds = new Set();
  const videos = [];
  const images = [];
  for (const metadataPath of metadataFiles) {
    const relative = path.relative(directoryPath, metadataPath).split(path.sep).map((part) => part.toLowerCase());
    const isImage = relative.includes("images");
    const media = isImage
      ? await scanImageMetadata(directoryPath, metadataPath, usedIds)
      : await scanVideoMetadata(directoryPath, metadataPath, usedIds);
    (isImage ? images : videos).push(media);
  }
  if (!metadataFiles.length) videos.push(...await scanLegacyFlatDirectory(directoryPath));
  const catalog = { directoryPath, videos, images, entries: videos, missing: false, scannedAt: new Date().toISOString(), errors: [...videos, ...images].filter((entry) => entry.errors.length).map((entry) => ({ id: entry.id, errors: entry.errors })) };
  await writeJson(path.join(app.getPath("userData"), "library-cache.json"), catalog);
  return catalog;
}

function collectionPath() { return path.join(app.getPath("userData"), "collection.json"); }
async function readCollection() {
  return await readJson(collectionPath(), { schemaVersion: 1, videos: {}, images: {} });
}
async function updateCollection(update = {}) {
  const collection = await readCollection();
  if (update.kind === "video" && update.id) collection.videos[update.id] = { ...(collection.videos[update.id] ?? {}), ...update.patch };
  if (update.kind === "image" && update.id) collection.images[update.id] = { ...(collection.images[update.id] ?? {}), ...update.patch };
  await writeJson(collectionPath(), collection);
  return collection;
}

ipcMain.handle("media:scan-library", async () => scanDirectory(selectedLibraryPath ?? path.join(app.getPath("userData"), "media")));
ipcMain.handle("media:choose-library", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  selectedLibraryPath = result.filePaths[0];
  return { canceled: false, ...(await scanDirectory(selectedLibraryPath)) };
});
ipcMain.handle("collection:get", readCollection);
ipcMain.handle("collection:update", (_event, update) => updateCollection(update));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280, height: 720, minWidth: 900, minHeight: 600, backgroundColor: "#111111",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") }
  });
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
