# Changelog

All notable changes to WhatsLNX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-05-27

### Added

- "Close button minimizes to tray" toggle in Settings (default: enabled). When disabled, the close button quits the app instead of hiding to tray.

### Fixed

- Tray context menu showed "Hide WhatsLNX" instead of "Show WhatsLNX" after close-to-tray. Context menu is now rebuilt on window show/hide events.
- Settings window threw "Attempted to register a second handler" error on reopening. IPC handlers are now registered once.
- Settings toggle for close-to-tray didn't respond to clicks. Fixed by wrapping toggle in `<label>`.
- Settings window content was clipped and not scrollable. Changed `overflow: hidden` to `overflow-y: auto`.
- App didn't quit when close-to-tray was disabled — window closed but tray stayed alive. Close handler now explicitly calls `app.quit()`.
- "Object has been destroyed" crash when interacting with tray menu after window was destroyed. Added `isDestroyed()` guards.

## [0.2.0] - 2026-05-26

### Added

- Official project website at `kmmuntasir.github.io/WhatsLNX` with install instructions, screenshots, features, and comparison table
- Light/dark/system theme toggle on the website
- CLI argument support and `/usr/bin/whatslnx` entry point
- Open source community files (CONTRIBUTING.md, SECURITY.md, ARCHITECTURE.md)
- Unit tests for utility functions
- CI pipeline with lint, test, and build stages
- Release pipeline with GitHub Releases publish and APT repo deployment to GitHub Pages
- `releaseType: release` in electron-builder config to prevent draft releases

### Fixed

- Desktop notifications not showing on Linux
- Settings window security (`contextIsolation: true`, `contextBridge`)
- GPG signing in CI with pinentry-mode loopback
- ESLint 10 compatibility and flat config
- APT Release file missing `Suite`/`Codename`/`Origin`/`Label` fields (conflicting distribution warning)

### Changed

- Tray badge improved: 3px yellow outline with black digit fill
- Bumped Node.js to 24, GitHub Actions to v6, GPG import action to v7
- Removed Snap and Flatpak support — AppImage and DEB only

## [0.1.0] - 2026-05-25

### Added

- WhatsApp Web wrapper with Electron 42
- Wayland and X11 auto-detection (`ozone-platform-hint=auto`)
- Audio/video calling with automatic media permissions
- Screen sharing via PipeWire and xdg-desktop-portal (Wayland + X11)
- Native desktop notifications via Electron Notification API
- Native file dialogs via xdg-desktop-portal
- Drag-and-drop file support
- System tray icon with unread message count badge (pixel-font canvas rendering)
- Launcher/dock unread count badge (`app.setBadgeCount`)
- Theme sync — follows desktop light/dark mode automatically
- Theme override — system, light, or dark via tray menu and settings window
- Font configuration — Serif, Sans-Serif, Monospace via `fc-list` system fonts
- Settings window with theme and font controls
- `whatsapp://` deep link handler (cold start + warm start)
- Session persistence across restarts
- Single instance lock — duplicate launches focus existing window
- Window state persistence (position, size, maximized)
- Window position clamping on display changes
- Auto-update for AppImage via GitHub Releases (4-hour poll cycle)
- APT repository for DEB packages with GPG-signed releases
- AppImage build target
- DEB build target with proper dependencies and post-install/remove scripts
- GitHub Actions CI pipeline (lint → test → build on develop)
- GitHub Actions release pipeline (build + publish on main, APT repo deploy to GitHub Pages)
- Unit tests for utility functions
- ESLint 9 flat config
- App icons in all sizes (16px–512px + SVG)
- Desktop entry with MIME type registration for `whatsapp://` URI scheme
- GPU crash recovery (`render-process-gone` handler)
- Standardized appId (`io.github.kmmuntasir.WhatsLNX`) across all configs
- Settings window with `contextIsolation: true` and `contextBridge` (no `nodeIntegration`)

[0.2.1]: https://github.com/kmmuntasir/WhatsLNX/releases/tag/v0.2.1
[0.2.0]: https://github.com/kmmuntasir/WhatsLNX/releases/tag/v0.2.0
[0.1.0]: https://github.com/kmmuntasir/WhatsLNX/releases/tag/v0.1.0
