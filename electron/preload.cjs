const { contextBridge, ipcRenderer, webUtils } = require("electron");
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld("switchyard", {
  pick: invoke("files:pick"),
  addPaths: invoke("files:add"),
  pathForFile: (file) => webUtils.getPathForFile(file),
  run: invoke("jobs:run"),
  cancel: invoke("jobs:cancel"),
  state: invoke("state:get"),
  reveal: invoke("output:reveal"),
  exportFile: invoke("output:export"),
  preview: invoke("files:preview"),
  mediaPreview: invoke("files:media-preview"),
  pdfPreview: invoke("files:pdf-preview"),
  saveSettings: invoke("settings:save"),
  messages: {
    initialize: async () => { await ipcRenderer.invoke('recall:open'); return ipcRenderer.invoke('recall:get-initial'); },
    open: invoke('recall:open-backup'),
    importContacts: invoke('recall:import-contacts'),
    thread: invoke('recall:get-thread'),
    search: invoke('recall:search'),
    clear: invoke('recall:clear-all'),
    exportXml: invoke('recall:export-xml'),
    pickExport: invoke('recall:pick-backup-path'),
    onProgress: fn => { const listener = (_, value) => fn(value); ipcRenderer.on('export-progress', listener); return () => ipcRenderer.removeListener('export-progress', listener); },
  },
  launchVoice: invoke("voice:launch"),
  engineStatus: invoke("engines:status"),
  chooseEngine: invoke("engines:choose"),
  copy: invoke("text:copy"),
  record: invoke("voice:record"),
  onUpdate: (fn) => {
    const listener = (_, state) => fn(state);
    ipcRenderer.on("state:update", listener);
    return () => ipcRenderer.removeListener("state:update", listener);
  },
});
