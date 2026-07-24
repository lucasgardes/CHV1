"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chv1Media", {
  scanLibrary: (options) => ipcRenderer.invoke("media:scan-library", options),
  chooseLibrary: () => ipcRenderer.invoke("media:choose-library"),
  getLibraryPath: () => ipcRenderer.invoke("media:get-library-path"),
  chooseImportFiles: (kind) => ipcRenderer.invoke("media:choose-import-files", kind),
  importVideo: (payload) => ipcRenderer.invoke("media:import-video", payload),
  finalizeVideoImport: (payload) => ipcRenderer.invoke("media:finalize-video-import", payload),
  importImage: (payload) => ipcRenderer.invoke("media:import-image", payload),
  getRegistries: () => ipcRenderer.invoke("media:get-registries"),
  getSettings: () => ipcRenderer.invoke("media:get-settings"),
  updateSettings: (patch) => ipcRenderer.invoke("media:update-settings", patch)
});

contextBridge.exposeInMainWorld("chv1Collection", {
  get: () => ipcRenderer.invoke("collection:get"),
  update: (payload) => ipcRenderer.invoke("collection:update", payload),
  unlockImage: (payload) => ipcRenderer.invoke("collection:unlock-image", payload)
});

contextBridge.exposeInMainWorld("chv1Playback", {
  record: (payload) => ipcRenderer.invoke("playback:record", payload),
  recentSessions: () => ipcRenderer.invoke("recent-sessions:get")
});

contextBridge.exposeInMainWorld("chv1VideoStats", {
  get: () => ipcRenderer.invoke("video-stats:get")
});
