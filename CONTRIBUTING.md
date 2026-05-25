# Contributing to WhatsLNX

Thanks for your interest! This guide covers how to report issues, suggest features, and submit code.

## Quick Start

```bash
git clone https://github.com/kmmuntasir/WhatsLNX.git
cd WhatsLNX
npm install
npm start          # Run in development mode
npm test           # Run tests
npm run lint       # Check code style
npm run build      # Build AppImage + DEB
```

**Prerequisites:** Node.js 24+, npm, Linux (Ubuntu 24.04+ recommended).

## Reporting Bugs

Open a [bug report issue](https://github.com/kmmuntasir/WhatsLNX/issues/new?template=bug_report.yml). Include:

- Linux distribution and version
- Desktop environment (GNOME, KDE, XFCE, etc.)
- Display server (Wayland or X11)
- WhatsLNX version
- Steps to reproduce
- Expected vs actual behavior

## Suggesting Features

Open a [feature request issue](https://github.com/kmmuntasir/WhatsLNX/issues/new?template=feature_request.yml). Describe the problem you're solving and your proposed solution.

## Pull Requests

1. **Fork** the repository
2. Create a branch from `develop`: `git checkout -b feature/my-feature`
3. Make your changes
4. Run `npm run lint && npm test` — both must pass
5. Open a PR against the `develop` branch

### PR Guidelines

- One logical change per PR
- Include tests for new functionality
- Update README if you change user-facing behavior
- Follow existing code style (ESLint enforces this)

## Code Style

ESLint with the `recommended` config. Key points:

- 2-space indentation
- Single quotes
- No unused variables (prefix with `_` if intentionally unused)
- CommonJS modules (`require`/`module.exports`)

## Project Structure

```
src/
  main.js              # Electron main process
  preload.js           # Main window context bridge
  notifications.js     # Native notification handling
  tray.js              # System tray icon and badge
  settings.js          # Settings window logic
  settings-preload.js  # Settings context bridge
  settings.html        # Settings UI
  updater.js           # Auto-update logic
  utils.js             # Pure utility functions
test/
  utils.test.js        # Unit tests
scripts/               # Build hooks and icon generation
assets/
  icons/               # App icons (16px–512px + SVG)
  screenshots/         # README screenshots
```

## Architecture

WhatsLNX is an Electron wrapper around WhatsApp Web. The main process (`src/main.js`) manages the BrowserWindow, permissions, downloads, and deep links. The preload script (`src/preload.js`) bridges unread count and notification data via `contextBridge`. The tray module (`src/tray.js`) renders badge icons using pixel-font glyphs on a canvas.

Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on the main window. Navigation is restricted to `whatsapp.com` domains only.

## License

By contributing, you agree your code will be licensed under [GPL-3.0](LICENSE).
