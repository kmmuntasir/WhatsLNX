# Architecture Overview

WhatsLNX is an Electron wrapper around [WhatsApp Web](https://web.whatsapp.com). It adds Linux-native integration on top of WhatsApp's web interface.

## Process Model

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│                   (main.js)                      │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Window   │  │  Tray    │  │  Permissions  │  │
│  │  Manager  │  │  Badge   │  │  Handler      │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Deep     │  │  Auto    │  │  Download     │  │
│  │  Links    │  │  Updater │  │  Handler      │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└──────────────┬──────────────────────────────────┘
               │ IPC (contextBridge)
┌──────────────┴──────────────────────────────────┐
│               Preload Script                     │
│                (preload.js)                      │
│                                                  │
│  Exposes: onTitleChange, getUnreadCount, send    │
│  Intercepts: Notification API, Service Worker    │
│  Injects: Font CSS overrides                     │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────┐
│              Renderer Process                    │
│                                                  │
│         https://web.whatsapp.com                 │
│         (sandboxed, context-isolated)            │
└─────────────────────────────────────────────────┘
```

## Module Responsibilities

| File | Role |
|---|---|
| `src/main.js` | App lifecycle, BrowserWindow, permissions, downloads, deep links, single instance |
| `src/preload.js` | Context bridge — exposes `onTitleChange`, `getUnreadCount`, `send` to renderer. Intercepts `Notification` API and Service Worker notifications. Injects font CSS. |
| `src/notifications.js` | Converts intercepted web notifications into native Electron notifications |
| `src/tray.js` | System tray icon, unread badge rendering (canvas pixel-font glyphs), context menu, theme toggle |
| `src/settings.js` | Settings BrowserWindow, theme and font configuration |
| `src/settings-preload.js` | Context bridge for settings window (`getSystemFonts`, `getSettings`, `setTheme`, `setFonts`) |
| `src/settings.html` | Settings UI — theme radio buttons, font dropdowns |
| `src/updater.js` | Auto-update check (4-hour interval), download, install notification |
| `src/utils.js` | Pure functions — URL parsing, position clamping, permission checking, badge label generation, font CSS generation, navigation validation |

## Security Model

- **Main window**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Settings window**: Same security posture — `contextBridge` + IPC, no direct Node access
- **Navigation**: Blocked if target is outside `whatsapp.com` domains
- **IPC surface**: Minimal — only what `contextBridge` explicitly exposes
- **No credential handling**: Session cookies managed by Chromium default session

## Data Flow

### Unread Badge

```
WhatsApp Web title change
  → MutationObserver in preload.js
  → parseUnreadCount() extracts count from title
  → IPC to main process
  → tray.js renders badge on canvas (pixel-font glyph)
  → app.setBadgeCount() for launcher/dock badge
```

### Native Notifications

```
WhatsApp Web calls new Notification() or sw.showNotification()
  → preload.js intercepts via window.Notification override + Service Worker patch
  → IPC notification data to main process
  → notifications.js creates native Electron Notification
  → System displays via DBus/libnotify
```

### Theme Sync

```
Desktop theme changes
  → Electron nativeTheme updates
  → main.js sets nativeTheme.themeSource from store
  → WhatsApp Web reads prefers-color-scheme media query
  → Theme applies automatically (no DOM manipulation needed)
```

## External Dependencies

| Dependency | Purpose |
|---|---|
| `electron-store` | Persistent key-value storage for settings and window state |
| `electron-updater` | Auto-update from GitHub Releases |
| `fc-list` (system) | Font discovery for settings UI |
| `xdg-desktop-portal` | Native file dialogs |
| `PipeWire` | Screen sharing on Wayland |
| `libnotify` / DBus | Desktop notifications |

## Packaging

- **AppImage**: Universal Linux package, auto-updates via GitHub Releases
- **DEB**: Debian/Ubuntu package, distributed via APT repository on GitHub Pages with GPG signing
