# Changelog

All notable changes to WhatsLNX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/kmmuntasir/WhatsLNX/releases/tag/v0.1.0
