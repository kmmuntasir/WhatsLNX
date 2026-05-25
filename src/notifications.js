const { Notification, nativeImage, net } = require('electron');
const path = require('path');

function getIconPath() {
  const possiblePaths = [
    path.join(__dirname, '..', 'assets', 'icons', '256x256.png'),
    path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
  ];

  for (const p of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(p)) return p;
    } catch {
      // continue
    }
  }
  return null;
}

async function resolveIcon(iconUrl) {
  // Data URL — use directly
  if (iconUrl && iconUrl.startsWith('data:')) {
    try {
      return nativeImage.createFromDataURL(iconUrl);
    } catch (e) {
      console.error('[notification] Failed to create icon from data URL:', e.message);
    }
  }

  // HTTP(S) URL — fetch then decode
  if (iconUrl && (iconUrl.startsWith('http://') || iconUrl.startsWith('https://'))) {
    try {
      const response = await net.fetch(iconUrl);
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        return nativeImage.createFromBuffer(buf);
      }
    } catch (e) {
      console.error('[notification] Failed to fetch remote icon:', e.message);
    }
  }

  // Fallback to local icon
  const iconPath = getIconPath();
  if (iconPath) return nativeImage.createFromPath(iconPath);
  return null;
}

async function showNativeNotification({ title, body, iconUrl } = {}, mainWindow) {
  if (!Notification.isSupported()) {
    console.error('[notification] Notification.isSupported() returned false — no notification daemon available');
    return;
  }

  try {
    const icon = await resolveIcon(iconUrl);

    const notification = new Notification({
      title: title || 'WhatsLNX',
      body: body || '',
      icon,
      silent: false,
    });

    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.on('error', (e) => {
      console.error('[notification] Notification error:', e);
    });

    notification.show();
  } catch (e) {
    console.error('[notification] Failed to show notification:', e);
  }
}

module.exports = { showNativeNotification };
