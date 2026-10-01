const { autoUpdater } = require('electron-updater');
const { Notification } = require('electron');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function initUpdater() {
  // checkForUpdates()/downloadUpdate() rejections are surfaced through the
  // 'error' event below — swallow the promise rejections to avoid
  // UnhandledPromiseRejectionWarning noise when offline.
  autoUpdater.checkForUpdates().catch(() => {});

  autoUpdater.on('update-available', (info) => {
    const notification = new Notification({
      title: 'WhatsLNX Update Available',
      body: `Version ${info.version} is available. Downloading...`,
      silent: true,
    });
    notification.show();
    autoUpdater.downloadUpdate().catch(() => {});
  });

  autoUpdater.on('update-downloaded', (info) => {
    const notification = new Notification({
      title: 'WhatsLNX Update Ready',
      body: `Version ${info.version} downloaded. Restart to install.`,
      silent: true,
    });
    notification.on('click', () => {
      autoUpdater.quitAndInstall();
    });
    notification.show();
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });

  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

module.exports = { initUpdater };
