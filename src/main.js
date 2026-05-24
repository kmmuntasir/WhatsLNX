const { app, BrowserWindow, session, shell, nativeTheme, dialog, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { createTray } = require('./tray');
const { showNativeNotification } = require('./notifications');
const { createSettingsWindow } = require('./settings');
const { initUpdater } = require('./updater');

const WHATSAPP_URL = 'https://web.whatsapp.com';
const CHROMIUM_VERSION = process.versions.chrome || '140.0.0.0';
const USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION} Safari/537.36`;

// Override Electron's default user agent globally (must be before any windows)
app.userAgentFallback = USER_AGENT;

let store = null;
let mainWindow = null;
let tray = null;
let deepLinkUrl = null;

// --- Wayland flags (must be before app.whenReady) ---
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,WebRTCPipeWireCapturer');
}

// --- Deep link protocol registration ---
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('whatsapp', process.execPath, [path.resolve(__dirname, '..')]);
} else {
  app.setAsDefaultProtocolClient('whatsapp');
}

// --- Single instance lock ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    const url = argv.find(arg => arg.startsWith('whatsapp://'));
    if (url) {
      handleDeepLink(url);
    }
  });

  app.whenReady().then(init);
}

// --- Check for deep link on cold start ---
const coldStartUrl = process.argv.find(arg => arg.startsWith('whatsapp://'));
if (coldStartUrl) {
  deepLinkUrl = coldStartUrl;
}

function handleDeepLink(url) {
  if (!mainWindow) return;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'send') {
      const phone = parsedUrl.searchParams.get('phone') || '';
      const text = parsedUrl.searchParams.get('text') || '';
      const waUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
      mainWindow.webContents.loadURL(waUrl);
    }
  } catch {
    // Invalid URL, ignore
  }
}

async function init() {
  // Dynamic import for ESM-only electron-store v11
  const { default: Store } = await import('electron-store');
  store = new Store({
    name: 'settings',
    defaults: {
      windowBounds: { width: 1100, height: 750 },
      windowPosition: { x: undefined, y: undefined },
      isMaximized: false,
      themeSource: 'system',
      fonts: {},
    },
  });

  const themeSource = store.get('themeSource', 'system');
  nativeTheme.themeSource = themeSource;

  createMainWindow();
  tray = createTray(mainWindow, store);

  // --- Permission handler ---
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'notifications', 'geolocation', 'display-capture'];
    callback(allowed.includes(permission));
  });

  // --- Screen sharing: desktopCapturer with long-lived cache ---
  let cachedScreenSource = null;
  let cacheTimer = null;

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    // Return cached source immediately (prevents portal reopening & timeout)
    if (cachedScreenSource) {
      callback({ video: cachedScreenSource });
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      });
      if (sources.length > 0) {
        const screen = sources.find(s => s.id.startsWith('screen')) || sources[0];
        cachedScreenSource = screen;
        if (cacheTimer) clearTimeout(cacheTimer);
        // Keep cache alive for 5 minutes — prevents timeout on slow picks
        cacheTimer = setTimeout(() => { cachedScreenSource = null; }, 300000);
        callback({ video: screen });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[display-media] Error:', err.message);
      callback({});
    }
  });

  // --- Download interception: use native save dialog ---
  session.defaultSession.on('will-download', (event, item) => {
    event.preventDefault();

    const filePath = dialog.showSaveDialogSync(mainWindow, {
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      title: 'Save File',
    });

    if (filePath) {
      item.setSavePath(filePath);
      item.resume();
    }
  });

  // --- Notification interception ---
  ipcMain.on('notification', (_event, data) => {
    showNativeNotification(data, mainWindow);
  });

  // --- Auto-updater (AppImage only) ---
  initUpdater();
}

function createMainWindow() {
  const bounds = store.get('windowBounds');
  const position = store.get('windowPosition');
  const isMaximized = store.get('isMaximized', false);

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 400,
    minHeight: 500,
    x: position.x,
    y: position.y,
    title: 'WhatsLNX',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Force user agent on webContents
  mainWindow.webContents.setUserAgent(USER_AGENT);

  mainWindow.loadURL(WHATSAPP_URL);

  // --- Override window title to "WhatsLNX (count)" + update tray badge ---
  mainWindow.on('page-title-updated', (event, title) => {
    event.preventDefault();
    const match = title.match(/^\((\d+)\)/);
    if (match) {
      mainWindow.setTitle(`WhatsLNX (${match[1]})`);
      if (tray) tray.updateBadge(parseInt(match[1], 10));
    } else {
      mainWindow.setTitle('WhatsLNX');
      if (tray) tray.updateBadge(0);
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // --- Open links in default browser ---
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // --- Navigation guard: stay on whatsapp.com ---
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://web.whatsapp.com') && !url.startsWith('https://whatsapp.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // --- Save window state on close ---
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', { width: bounds.width, height: bounds.height });
      store.set('windowPosition', { x: bounds.x, y: bounds.y });
    }
    store.set('isMaximized', mainWindow.isMaximized());
  });

  // Handle deep link + re-apply fonts on every page load
  mainWindow.webContents.on('did-finish-load', () => {
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
      deepLinkUrl = null;
    }

    const fonts = store.get('fonts', {});
    if (fonts && (fonts.serif || fonts.sansSerif || fonts.monospace)) {
      mainWindow.webContents.send('apply-fonts', fonts);
    }
  });
}

// --- App lifecycle ---
app.on('window-all-closed', () => {
  // Don't quit — tray keeps app alive
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
