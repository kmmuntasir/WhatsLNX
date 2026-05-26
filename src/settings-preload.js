const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setTheme: (theme) => ipcRenderer.send('settings-theme', theme),
  setCloseToTray: (enabled) => ipcRenderer.send('settings-close-to-tray', enabled),
  setFonts: (fonts) => ipcRenderer.send('settings-fonts', fonts),
});
