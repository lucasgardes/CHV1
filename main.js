const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mkv", ".mov"]);
let selectedLibraryPath = null;

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function scanDirectory(directoryPath) {
  if (!directoryPath || !(await fileExists(directoryPath))) {
    return { directoryPath, entries: [], missing: true };
  }
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const entries = [];
  for (const entry of directoryEntries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension)) continue;
    const videoPath = path.join(directoryPath, entry.name);
    const baseName = path.basename(entry.name, extension);
    const funscriptPath = path.join(directoryPath, `${baseName}.funscript`);
    const stat = await fs.stat(videoPath);
    entries.push({
      id: baseName,
      title: baseName.replace(/[-_]+/g, " "),
      videoPath,
      funscriptPath: (await fileExists(funscriptPath)) ? funscriptPath : null,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs
    });
  }
  return { directoryPath, entries, missing: false };
}

ipcMain.handle("media:scan-library", async () => {
  const fallbackPath = path.join(app.getPath("userData"), "media");
  return scanDirectory(selectedLibraryPath ?? fallbackPath);
});

ipcMain.handle("media:choose-library", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  selectedLibraryPath = result.filePaths[0];
  return { canceled: false, ...(await scanDirectory(selectedLibraryPath)) };
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#111111",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
