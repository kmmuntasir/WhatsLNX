# WhatsLNX

A minimalist, high-performance unofficial WhatsApp desktop client for Linux.

WhatsLNX wraps [WhatsApp Web](https://web.whatsapp.com) inside a tailored Electron shell that prioritizes system-native behavior, Wayland compatibility, and flawless WebRTC (audio/video calling) support.

## Features

- **Wayland & X11** — Auto-detected, no manual flags needed
- **Audio/Video Calling** — Automatic camera and microphone permissions
- **Native Notifications** — System notification bubbles via DBus
- **Native File Dialogs** — xdg-desktop-portal for uploads and downloads
- **Drag & Drop** — Drop files from Nautilus, Dolphin, or Thunar directly into chat
- **Theme Sync** — Automatically follows your desktop's light/dark mode
- **Font Configuration** — Set Serif, Sans-Serif, and Monospace fonts via Settings
- **System Tray** — Tray icon with unread message count badge
- **Deep Links** — Handles `whatsapp://` URI scheme system-wide
- **Session Persistence** — Stay logged in between app restarts
- **Single Instance** — Prevents duplicate windows and session corruption
- **Auto-Update** — AppImage releases update automatically (via GitHub Releases)

## Installation

### AppImage (Recommended)

Universal, no-install release. Works on any Linux distribution.

```bash
# Download the latest AppImage
wget https://github.com/kmmuntasir/WhatsLNX/releases/latest/download/WhatsLNX-*.AppImage

# Make it executable
chmod +x WhatsLNX-*.AppImage

# Run
./WhatsLNX-*.AppImage
```

### Snap (Ubuntu)

```bash
snap install whatslnx
```

Camera and microphone permissions are auto-connected — no manual `snap connect` needed.

### DEB (Ubuntu/Debian/Linux Mint)

```bash
# Download the latest .deb
wget https://github.com/kmmuntasir/WhatsLNX/releases/latest/download/whatslnx_*.amd64.deb

# Install
sudo dpkg -i whatslnx_*.amd64.deb
sudo apt-get install -f  # Fix missing dependencies
```

## Building from Source

### Prerequisites

- Node.js 18+ and npm
- Linux (Ubuntu 24.04+ recommended)

### Build

```bash
git clone https://github.com/kmmuntasir/WhatsLNX.git
cd WhatsLNX
npm install
npm start        # Run in development mode
npm run build    # Build all packages (AppImage + Snap + DEB)
```

### Individual targets

```bash
npm run build:appimage
npm run build:snap
npm run build:deb
```

Build artifacts go to `dist/`.

## Configuration

All settings are accessible via the **tray icon context menu** → **Settings**.

### Theme

| Option | Behavior |
|--------|----------|
| System (default) | Follows your desktop's light/dark theme automatically |
| Light | Forces light mode |
| Dark | Forces dark mode |

### Fonts

Configure **Serif**, **Sans-Serif**, and **Monospace** font families. All system fonts are detected automatically via `fc-list`. Click **Reset to Default** to clear custom fonts.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Close window | Minimize to tray (app keeps running) |
| Tray left-click | Show/hide window |
| Tray right-click | Context menu |

## Deep Links

WhatsLNX registers as the system handler for `whatsapp://` URIs. Supported formats:

```
whatsapp://send?phone=1234567890
whatsapp://send?phone=1234567890&text=Hello
whatsapp://send?text=Hello
```

Clicking these links in any application will open WhatsLNX and navigate to the compose view.

## Supported Platforms

| Distribution | Status |
|-------------|--------|
| Ubuntu 24.04 / 26.04 | Primary |
| Linux Mint 21.x / 22.x | Primary |
| Elementary OS 7 / 8 | Primary |
| Debian 12 (Bookworm) / 13 (Trixie) | Primary |
| Fedora 40+ | Secondary (AppImage) |
| Arch Linux / Manjaro | Secondary (AppImage) |

### Desktop Environments

Tested on GNOME 46+ (Wayland/X11), KDE Plasma 6+ (Wayland/X11), XFCE 4.18+.

## Known Issues

- **GNOME tray icons** require the [AppIndicator](https://extensions.gnome.org/extension/615/appindicator-support/) extension
- **Screen sharing on Wayland** requires PipeWire and xdg-desktop-portal (pre-installed on most modern distros)
- WhatsApp Web is a third-party service — feature availability depends on Meta's deployment

## License

[GPL-3.0](LICENSE)
