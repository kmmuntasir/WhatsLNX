const { Notification, nativeImage } = require('electron');
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

function showNativeNotification({ title, body, iconUrl } = {}, mainWindow) {
  if (!Notification.isSupported()) return;

  let icon;
  if (iconUrl) {
    icon = nativeImage.createFromDataURL(iconUrl);
  } else {
    const iconPath = getIconPath();
    if (iconPath) icon = nativeImage.createFromPath(iconPath);
  }

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

  notification.show();
}

module.exports = { showNativeNotification };
