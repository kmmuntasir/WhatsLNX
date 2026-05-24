const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const zlib = require('zlib');

let tray = null;
let unreadCount = 0;
let baseIcon = null;

const TRAY_SIZE = 22;
const BADGE_RADIUS = 4;

// --- CRC32 for PNG chunks ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Generate PNG from raw RGBA pixel data ---
function rgbaToPNG(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Add filter byte 0 before each row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const srcOffset = y * width * 4;
    const dstOffset = y * (1 + width * 4);
    raw[dstOffset] = 0;
    rgba.copy(raw, dstOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
    return Buffer.concat([len, typeB, data, crcB]);
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// --- Draw red badge on icon ---
function createBadgedIcon(icon, count) {
  if (!icon || count <= 0) return icon;

  const size = TRAY_SIZE;
  const resized = icon.resize({ width: size, height: size });
  const bgra = resized.toBitmap(); // Electron returns BGRA on Linux

  // Convert BGRA -> RGBA
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 4) {
    rgba[i]     = bgra[i + 2]; // R
    rgba[i + 1] = bgra[i + 1]; // G
    rgba[i + 2] = bgra[i];     // B
    rgba[i + 3] = bgra[i + 3]; // A
  }

  // Draw red circle badge in bottom-right corner
  const cx = size - BADGE_RADIUS - 1;
  const cy = size - BADGE_RADIUS - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (dist <= BADGE_RADIUS) {
        // Anti-aliased edge
        const alpha = dist > BADGE_RADIUS - 0.8
          ? Math.round(255 * (BADGE_RADIUS - dist) / 0.8)
          : 255;
        rgba[idx]     = 230;
        rgba[idx + 1] = 30;
        rgba[idx + 2] = 30;
        rgba[idx + 3] = Math.max(0, Math.min(255, alpha));
      }
    }
  }

  const png = rgbaToPNG(rgba, size, size);
  return nativeImage.createFromBuffer(png);
}

function getIconPath() {
  const possiblePaths = [
    path.join(__dirname, '..', 'assets', 'icons', '512x512.png'),
    path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
  ];
  for (const p of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function createTray(mainWindow, store) {
  const iconPath = getIconPath();
  if (iconPath) {
    baseIcon = nativeImage.createFromPath(iconPath).resize({ width: TRAY_SIZE, height: TRAY_SIZE });
  } else {
    baseIcon = nativeImage.createEmpty();
  }

  tray = new Tray(baseIcon);
  tray.setToolTip('WhatsLNX');
  updateContextMenu(mainWindow, store);

  // Expose badge update method on tray
  tray.updateBadge = (count) => {
    unreadCount = count;
    updateTooltip();
    updateIcon();
    updateContextMenu(mainWindow, store);
  };

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const { ipcMain } = require('electron');
  ipcMain.on('unread-count', (_event, count) => {
    unreadCount = count;
    updateTooltip();
    updateIcon();
    updateContextMenu(mainWindow, store);
  });

  return tray;
}

function updateTooltip() {
  if (!tray) return;
  if (unreadCount > 0) {
    tray.setToolTip(`WhatsLNX - ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`);
  } else {
    tray.setToolTip('WhatsLNX');
  }
}

function updateIcon() {
  if (!tray || !baseIcon) return;
  if (unreadCount > 0) {
    const badged = createBadgedIcon(baseIcon, unreadCount);
    tray.setImage(badged);
  } else {
    tray.setImage(baseIcon);
  }
}

function updateContextMenu(mainWindow, store) {
  const isVisible = mainWindow.isVisible();
  const themeSource = store.get('themeSource', 'system');
  const { createSettingsWindow } = require('./settings');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide WhatsLNX' : 'Show WhatsLNX',
      click: () => {
        if (isVisible) { mainWindow.hide(); } else { mainWindow.show(); mainWindow.focus(); }
      },
    },
    {
      label: 'Settings...',
      click: () => { createSettingsWindow(mainWindow, store); },
    },
    {
      label: 'Reload',
      click: () => { mainWindow.webContents.reloadIgnoringCache(); },
    },
    { type: 'separator' },
    {
      label: 'Theme',
      submenu: [
        {
          label: 'System', type: 'radio', checked: themeSource === 'system',
          click: () => { require('electron').nativeTheme.themeSource = 'system'; store.set('themeSource', 'system'); updateContextMenu(mainWindow, store); },
        },
        {
          label: 'Light', type: 'radio', checked: themeSource === 'light',
          click: () => { require('electron').nativeTheme.themeSource = 'light'; store.set('themeSource', 'light'); updateContextMenu(mainWindow, store); },
        },
        {
          label: 'Dark', type: 'radio', checked: themeSource === 'dark',
          click: () => { require('electron').nativeTheme.themeSource = 'dark'; store.set('themeSource', 'dark'); updateContextMenu(mainWindow, store); },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

module.exports = { createTray };
