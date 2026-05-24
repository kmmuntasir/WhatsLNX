const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatslnx', {
  // Unread count extraction via document.title watcher
  onTitleChange: (callback) => {
    const observer = new MutationObserver(() => {
      const title = document.title;
      const match = title.match(/^\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;
      callback(count);
    });

    // Watch <title> element for changes
    const titleEl = document.querySelector('title');
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    } else {
      // Fallback: watch head for title element insertion
      const headObserver = new MutationObserver(() => {
        const el = document.querySelector('title');
        if (el) {
          observer.observe(el, { childList: true, characterData: true, subtree: true });
          headObserver.disconnect();
        }
      });
      headObserver.observe(document.head, { childList: true });
    }

    // Also watch for attribute changes on the html element (some apps set title differently)
    const titleInterval = setInterval(() => {
      const title = document.title;
      const match = title.match(/^\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;
      callback(count);
    }, 2000);

    return () => {
      observer.disconnect();
      clearInterval(titleInterval);
    };
  },

  // Get initial unread count
  getUnreadCount: () => {
    const title = document.title;
    const match = title.match(/^\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  },

  // Apply font CSS overrides
  applyFonts: (fonts) => {
    const existing = document.getElementById('whatslnx-fonts');
    if (existing) existing.remove();

    if (!fonts || (!fonts.serif && !fonts.sansSerif && !fonts.monospace)) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'whatslnx-fonts';
    let css = '';
    if (fonts.sansSerif) css += `* { font-family: '${fonts.sansSerif}', sans-serif !important; }\n`;
    if (fonts.serif) css += `serif, .serif { font-family: '${fonts.serif}', serif !important; }\n`;
    if (fonts.monospace) css += `code, pre, .monospace, [data-font="monospace"] { font-family: '${fonts.monospace}', monospace !important; }\n`;
    style.textContent = css;
    document.head.appendChild(style);
  },

  // Remove font overrides
  resetFonts: () => {
    const existing = document.getElementById('whatslnx-fonts');
    if (existing) existing.remove();
  },

  // IPC helpers
  send: (channel, data) => {
    const validChannels = ['unread-count', 'fonts-changed', 'notification'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on: (channel, callback) => {
    const validChannels = ['apply-fonts', 'reset-fonts'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, data) => callback(data));
    }
  },
});

// --- Hide Electron fingerprints ---
// contextIsolation + sandbox already prevent most detection.
// UA spoofing is handled via session webRequest in main process.

// --- Auto-report unread count ---
window.addEventListener('DOMContentLoaded', () => {
  console.log('[preload] DOMContentLoaded fired');
  const initialCount = window.whatslnx.getUnreadCount();
  console.log('[preload] Initial unread count:', initialCount);
  window.whatslnx.send('unread-count', initialCount);

  const cleanup = window.whatslnx.onTitleChange((count) => {
    console.log('[preload] Title changed, count:', count);
    window.whatslnx.send('unread-count', count);
  });
});

// --- Intercept WhatsApp Web notifications and forward to main ---
window.addEventListener('DOMContentLoaded', () => {
  // Override the Notification API so WhatsApp's notifications go through our bridge
  const OriginalNotification = window.Notification;

  window.Notification = function(title, options = {}) {
    // Forward to main process for native display
    window.whatslnx.send('notification', {
      title: title || 'WhatsLNX',
      body: options.body || '',
      icon: options.icon || '',
    });
  };

  // Preserve static properties
  window.Notification.permission = OriginalNotification.permission;
  window.Notification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
  Object.defineProperty(window.Notification, 'permission', {
    get: () => 'granted',
  });
  window.Notification.requestPermission = () => Promise.resolve('granted');
});
