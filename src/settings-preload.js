const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setTheme: (theme) => ipcRenderer.send('settings-theme', theme),
  setFonts: (fonts) => ipcRenderer.send('settings-fonts', fonts),
});
