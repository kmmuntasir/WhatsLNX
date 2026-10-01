# Changelog

All notable changes to WhatsLNX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-10-02

### Added

- "About WhatsLNX" tray menu item opening a window with the current version
  and this release's notes (no more `whatslnx -v` in a terminal)
- "License" tray menu item opening a viewer for the full GPL-3.0 text

### Fixed

- Deep links (`whatsapp://send?...`) reloaded the app and then wedged on a
  blank window: WhatsApp Web registers a `beforeunload` handler, which
  silently cancelled the deep-link navigation. The window now forces
  navigations past `beforeunload` (`will-prevent-unload`), so links open the
  chat reliably
- Save dialog appeared twice for one download: WhatsApp Web fires the same
  download twice in quick succession and each request prompted again.
  Duplicate requests (same URL + filename within 10 s) now reuse the
  already-approved save path silently

## [0.3.2] - 2026-10-02

### Added

- Embedded AppImage update information (`gh-releases-zsync` channel) and a
  matching `.zsync` asset per release, so users can update with AppImageUpdate
  / appimageupdate-style tools in addition to the built-in electron-updater

## [0.3.1] - 2026-10-02

### Fixed

- AppImage repack: `--appimage-extract` applies the caller's umask, so the
  repacked squashfs stored `0700` directories. Environments that extract the
  AppImage as root (e.g. firejail `--appimage`, used by the AppImage catalog
  test) then cannot traverse to `AppRun` as the regular user ("Permission
  denied"). The repack script now normalizes with `chmod -R a+rX` before
  packing, matching electron-builder's stored `0755` directories

### Changed

- README now links the project website / APT repository at
  `kmmuntasir.github.io/WhatsLNX`

## [0.3.0] - 2026-10-02

### Added

- Offline page: when WhatsApp Web cannot be reached (no network), a local
  "You're offline" screen is shown instead of a blank window, with a Reconnect
  button, automatic retry every 15 seconds, and instant retry when connectivity
  returns (fixes the AppImage catalog test failure — the app now shows content
  when started without network access)

### Fixed

- File downloads: clicking download on a received file showed the save dialog
  but never saved anything — `event.preventDefault()` in the `will-download`
  handler cancels the download in current Electron versions. The handler now
  always resolves to either the chosen save path or an explicit cancel
- Auto-updater no longer emits `UnhandledPromiseRejectionWarning` when the
  machine is offline (rejections are handled via the existing error handler)

### Changed

- AppImage is repacked with the modern statically-linked AppImage runtime
  (`type2-runtime` via `appimagetool`) — it no longer depends on the EOL
  libfuse2 or the system C library to mount, so it runs out of the box on
  current distributions (Ubuntu 24.04+, Fedora, Arch, …). Delta updates are
  replaced by full downloads; `latest-linux.yml` is regenerated with matching
  checksums (`npm run build:appimage && npm run repack:appimage` locally)
- Release workflow publishes via `gh release create` after the repack step
- Updated Electron 42.2.0 → 44.5.1 (Chromium 140 → 152), electron-builder
  26.8.1 → 26.15.3, electron-updater 6.8.3 → 6.8.9, ESLint 10.4.0 → 10.11.0
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
