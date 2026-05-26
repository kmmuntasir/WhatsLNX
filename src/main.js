// --- CLI argument handling (before Electron loads) ---
const cliArgs = process.argv.slice(1);
const fs = require('fs');
const cliPath = require('path');

if (cliArgs.includes('--version') || cliArgs.includes('-v')) {
  const versionFile = cliPath.join(__dirname, '..', 'VERSION');
  let version = 'unknown';
  try {
    version = fs.readFileSync(versionFile, 'utf8').trim();
  } catch {
    try {
      const pkg = JSON.parse(fs.readFileSync(cliPath.join(__dirname, '..', 'package.json'), 'utf8'));
      version = pkg.version || version;
    } catch {
      // version fallback to hardcoded default
    }
  }
  console.log(`WhatsLNX v${version}`);
  process.exit(0);
}

if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  console.log(`Usage: whatslnx [options] [whatsapp://URI]

Options:
  -v, --version    Print version and exit
  -h, --help       Print this help message and exit

Examples:
  whatslnx                    Launch WhatsLNX
  whatslnx --version          Show version
  whatslnx whatsapp://send    Open WhatsApp with deep link`);
  process.exit(0);
}

// Set ELECTRON_DISABLE_SANDBOX before requiring electron
if (process.platform === 'linux') {
  process.env.ELECTRON_DISABLE_SANDBOX = '1';
}

const { app, BrowserWindow, session, shell, nativeTheme, dialog, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const { createTray, updateContextMenu } = require('./tray');
const { showNativeNotification } = require('./notifications');

const { initUpdater } = require('./updater');
const { parseUnreadCount, isPermissionAllowed, buildDeepLinkUrl, clampPosition: clampPositionUtil, isAllowedNavigation } = require('./utils');

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
app.setAppUserModelId('io.github.kmmuntasir.WhatsLNX');
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
  const waUrl = buildDeepLinkUrl(url);
  if (waUrl) {
    mainWindow.webContents.loadURL(waUrl);
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
      closeToTray: true,
      fonts: {},
    },
  });

  const themeSource = store.get('themeSource', 'system');
  nativeTheme.themeSource = themeSource;

  createMainWindow();
  tray = createTray(mainWindow, store);

  // --- Permission handler ---
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const granted = isPermissionAllowed(permission);
    console.log('[permission]', permission, granted ? 'granted' : 'denied');
    callback(granted);
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
    console.log('[notification] Received from renderer:', data?.title);
    showNativeNotification(data, mainWindow).catch((e) => {
      console.error('[notification] showNativeNotification failed:', e);
    });
  });

  // --- Auto-updater (AppImage only) ---
  initUpdater();
}

function createMainWindow() {
  const bounds = store.get('windowBounds');
  const position = clampPositionUtil(
    store.get('windowPosition'),
    screen.getAllDisplays(),
    screen.getPrimaryDisplay().workArea
  );
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
    const count = parseUnreadCount(title);
    if (count > 0) {
      mainWindow.setTitle(`WhatsLNX (${count})`);
      if (tray) tray.updateBadge(count);
      app.setBadgeCount(count);
    } else {
      mainWindow.setTitle('WhatsLNX');
      if (tray) tray.updateBadge(0);
      app.setBadgeCount(0);
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
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // --- Save window state on close ---
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      if (store.get('closeToTray', true)) {
        event.preventDefault();
        mainWindow.hide();
        if (tray) updateContextMenu(mainWindow, store);
        return;
      }
      // closeToTray disabled — save state and quit
      app.isQuitting = true;
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

// --- GPU / renderer crash recovery ---
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[crash] Renderer gone:', details.reason);
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents === webContents) {
    mainWindow.destroy();
    mainWindow = null;
    createMainWindow();
  }
});

app.on('child-process-gone', (_event, details) => {
  if (details.type === 'GPU') {
    console.error('[crash] GPU process gone:', details.reason);
    app.relaunch();
    app.exit(0);
  }
});
