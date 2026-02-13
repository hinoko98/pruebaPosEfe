"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  login: (payload) => electron.ipcRenderer.invoke("auth:login", payload),
  createUser: (payload) => electron.ipcRenderer.invoke("auth:createUser", payload)
});
