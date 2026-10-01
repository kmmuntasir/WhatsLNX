const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatslnxAbout', {
  getAboutInfo: () => ipcRenderer.invoke('get-about-info'),
  getLicenseText: () => ipcRenderer.invoke('get-license-text'),
  openLicenseWindow: () => ipcRenderer.send('open-license-window'),
});
