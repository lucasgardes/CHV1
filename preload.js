"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chv1Media", {
  scanLibrary: () => ipcRenderer.invoke("media:scan-library"),
  chooseLibrary: () => ipcRenderer.invoke("media:choose-library")
});
