const { BrowserWindow, ipcMain, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { extractChangelogSection, escapeHtml } = require('./utils');

let aboutWindow = null;
let licenseWindow = null;
let ipcRegistered = false;
let parentWindow = null;

// Read a file shipped at the app root (works in dev and from inside the
// packaged app.asar — Electron's fs patching resolves asar paths).
function readAppFile(name) {
  const candidates = [
    path.join(__dirname, '..', name),
    path.join(process.resourcesPath || '', name),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      // try next candidate
    }
  }
  return '';
}

// Render a changelog section (### headings, - bullets) as simple HTML.
function changelogToHtml(section) {
  if (!section) return '<p class="muted">No release notes available for this version.</p>';
  const out = [];
  let inList = false;
  for (const raw of section.split('\n')) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^-\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

// Keep external links (repo, website) in the default browser
function applyExternalLinkHandler(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createAboutWindow(mainWindow) {
  parentWindow = mainWindow || parentWindow;
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 480,
    height: 620,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: 'About WhatsLNX',
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'about-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  applyExternalLinkHandler(aboutWindow);
  aboutWindow.loadFile(path.join(__dirname, 'about.html'));

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });

  aboutWindow.on('close', () => {
    aboutWindow = null;
  });
}

function createLicenseWindow(mainWindow) {
  parentWindow = mainWindow || parentWindow;
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.show();
    licenseWindow.focus();
    return;
  }

  licenseWindow = new BrowserWindow({
    width: 600,
    height: 640,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: 'WhatsLNX License',
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'about-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  applyExternalLinkHandler(licenseWindow);
  licenseWindow.loadFile(path.join(__dirname, 'license.html'));

  licenseWindow.once('ready-to-show', () => {
    licenseWindow.show();
  });

  licenseWindow.on('close', () => {
    licenseWindow = null;
  });
}

function registerIpcHandlers(mainWindow) {
  parentWindow = mainWindow || parentWindow;
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('get-about-info', () => {
    const version = app.getVersion();
    const changelog = readAppFile('CHANGELOG.md');
    return {
      version,
      notesHtml: changelogToHtml(extractChangelogSection(changelog, version)),
    };
  });

  ipcMain.handle('get-license-text', () => {
    return readAppFile('LICENSE');
  });

  ipcMain.on('open-license-window', () => {
    createLicenseWindow(parentWindow);
  });
}

module.exports = { registerIpcHandlers, createAboutWindow, createLicenseWindow };
