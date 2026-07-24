"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chv1Media", {
  scanLibrary: () => ipcRenderer.invoke("media:scan-library"),
  chooseLibrary: () => ipcRenderer.invoke("media:choose-library"),
  getLibraryPath: () => ipcRenderer.invoke("media:get-library-path"),
  chooseImportFiles: (kind) => ipcRenderer.invoke("media:choose-import-files", kind),
  importVideo: (payload) => ipcRenderer.invoke("media:import-video", payload),
  importImage: (payload) => ipcRenderer.invoke("media:import-image", payload)
});

contextBridge.exposeInMainWorld("chv1Collection", {
  get: () => ipcRenderer.invoke("collection:get"),
  update: (payload) => ipcRenderer.invoke("collection:update", payload)
});

contextBridge.exposeInMainWorld("chv1Playback", {
  record: (payload) => ipcRenderer.invoke("playback:record", payload)
});

contextBridge.exposeInMainWorld("chv1VideoStats", {
  get: () => ipcRenderer.invoke("video-stats:get")
});
