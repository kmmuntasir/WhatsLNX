const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

let settingsWindow = null;

function getSystemFonts() {
  try {
    // Use fc-list to get system fonts on Linux
    const output = execSync(
      "fc-list --format='%{family}\\n' | sort -u",
      { encoding: 'utf-8', timeout: 5000 }
    );
    return [...new Set(output.trim().split('\n').filter(Boolean))].sort();
  } catch {
    return [
      'Noto Sans', 'Noto Serif', 'Noto Sans Mono',
      'Ubuntu', 'Ubuntu Mono', 'DejaVu Sans', 'DejaVu Sans Mono',
      'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
      'Times New Roman', 'Courier New',
    ];
  }
}

function createSettingsWindow(mainWindow, store) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'WhatsLNX Settings',
    parent: mainWindow,
    modal: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('close', () => {
    settingsWindow = null;
  });

  // --- IPC handlers for settings window ---
  ipcMain.handle('get-system-fonts', () => {
    return getSystemFonts();
  });

  ipcMain.handle('get-settings', () => {
    return {
      themeSource: store.get('themeSource', 'system'),
      fonts: store.get('fonts', {}),
    };
  });

  ipcMain.on('settings-theme', (_event, theme) => {
    const { nativeTheme } = require('electron');
    nativeTheme.themeSource = theme;
    store.set('themeSource', theme);
  });

  ipcMain.on('settings-fonts', (_event, fonts) => {
    if (!fonts) {
      store.delete('fonts');
      // Tell preload to reset fonts
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reset-fonts');
      }
    } else {
      store.set('fonts', fonts);
      // Tell preload to apply fonts
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('apply-fonts', fonts);
      }
    }
  });
}

module.exports = { createSettingsWindow };
