const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatslnx', {
  onTitleChange: (callback) => {
    const observer = new MutationObserver(() => {
      const title = document.title;
      const match = title.match(/^\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;
      callback(count);
    });

    const titleEl = document.querySelector('title');
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    } else {
      const headObserver = new MutationObserver(() => {
        const el = document.querySelector('title');
        if (el) {
          observer.observe(el, { childList: true, characterData: true, subtree: true });
          headObserver.disconnect();
        }
      });
      headObserver.observe(document.head, { childList: true });
    }

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

  getUnreadCount: () => {
    const title = document.title;
    const match = title.match(/^\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  },

  send: (channel, data) => {
    const validChannels = ['unread-count', 'fonts-changed', 'notification'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});

// --- Subscribe to main process IPC directly (not via contextBridge) ---

// Auto-apply fonts from main process
ipcRenderer.on('apply-fonts', (_event, fonts) => {
  const existing = document.getElementById('whatslnx-fonts');
  if (existing) existing.remove();

  if (!fonts || (!fonts.serif && !fonts.sansSerif && !fonts.monospace)) return;

  const style = document.createElement('style');
  style.id = 'whatslnx-fonts';
  let css = '';
  if (fonts.sansSerif) css += `* { font-family: '${fonts.sansSerif}', sans-serif !important; }\n`;
  if (fonts.serif) css += `serif, .serif { font-family: '${fonts.serif}', serif !important; }\n`;
  if (fonts.monospace) css += `code, pre, .monospace, [data-font="monospace"] { font-family: '${fonts.monospace}', monospace !important; }\n`;
  style.textContent = css;
  document.head.appendChild(style);
});

ipcRenderer.on('reset-fonts', () => {
  const existing = document.getElementById('whatslnx-fonts');
  if (existing) existing.remove();
});

// --- Intercept WhatsApp Web notifications ---
window.addEventListener('DOMContentLoaded', () => {
  window.Notification = function(title, options = {}) {
    ipcRenderer.send('notification', {
      title: title || 'WhatsLNX',
      body: options.body || '',
      icon: options.icon || '',
    });
  };
  Object.defineProperty(window.Notification, 'permission', { get: () => 'granted' });
  window.Notification.requestPermission = () => Promise.resolve('granted');
});
