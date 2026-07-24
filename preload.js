"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chv1Media", {
  scanLibrary: () => ipcRenderer.invoke("media:scan-library"),
  chooseLibrary: () => ipcRenderer.invoke("media:choose-library")
});

contextBridge.exposeInMainWorld("chv1Collection", {
  get: () => ipcRenderer.invoke("collection:get"),
  update: (payload) => ipcRenderer.invoke("collection:update", payload)
});
