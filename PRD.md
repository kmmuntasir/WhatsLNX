# Product Requirements Document: WhatsLNX

**Version:** 1.0.0  
**Date:** 2026-05-24  
**Author:** Muntasir Billah Munna  
**Repository:** https://github.com/kmmuntasir/WhatsLNX  
**Status:** Draft  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Audience](#3-target-audience)
4. [Technical Architecture](#4-technical-architecture)
5. [Functional Requirements](#5-functional-requirements)
6. [OS Integration Requirements](#6-os-integration-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Packaging & Distribution](#8-packaging--distribution)
9. [User Interface Specification](#9-user-interface-specification)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Release Phases](#12-release-phases)
13. [Success Metrics](#13-success-metrics)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Appendix A: Competitive Analysis](#appendix-a-competitive-analysis)
16. [Appendix B: Technical References](#appendix-b-technical-references)

---

## 1. Project Overview

**WhatsLNX** is a minimalist, high-performance unofficial WhatsApp desktop client for Linux. It wraps `web.whatsapp.com` inside a tailored Electron shell that prioritizes system-native behavior, Wayland compatibility, and flawless WebRTC (audio/video calling) support.

### 1.1 Core Philosophy

- **Native-first**: Use Linux desktop standards (xdg-desktop-portal, DBus notifications, system theme detection) instead of custom UI overlays.
- **Zero-configuration**: Wayland flags, media permissions, and sandbox plugs work out of the box. No terminal commands required.
- **Minimal footprint**: Smaller memory usage than a standard Chrome tab running WhatsApp Web.

### 1.2 Supported Platforms

| Priority | Distribution | Package Format |
|----------|-------------|----------------|
| **Primary** | Ubuntu 24.04 LTS, Ubuntu 26.04 LTS | DEB, Snap, AppImage |
| **Primary** | Linux Mint 21.x/22.x | DEB, AppImage |
| **Primary** | Elementary OS 7/8 | DEB, AppImage |
| **Primary** | Debian 12 (Bookworm), Debian 13 (Trixie) | DEB, AppImage |
| **Secondary** | Fedora 40+ | AppImage |
| **Secondary** | Arch Linux / Manjaro | AppImage, AUR (community) |
| **Secondary** | openSUSE Tumbleweed | AppImage |

All primary targets are **mandatory**. Secondary targets are encouraged but not blocking for v1.0 release.

### 1.3 Desktop Environments

Must be tested and verified on:
- GNOME 46+ (Wayland and X11)
- KDE Plasma 6+ (Wayland and X11)
- XFCE 4.18+

---

## 2. Problem Statement

Existing unofficial WhatsApp Linux clients (Whatsdesk, Whatsie, WhatsApp for Linux) fail to deliver a modern desktop experience. The specific pain points are:

### 2.1 Wayland Incompatibility

Modern Linux distributions (Ubuntu 22.04+, Fedora 35+) default to Wayland. Existing wrappers crash or exhibit segmentation faults because they do not set the correct Chromium Ozone platform flags. Users must manually edit `.desktop` files or create shell wrapper scripts — an unacceptable UX.

### 2.2 WebRTC Failures

Audio and video calling either does not work at all or fails due to improperly sandboxed camera/microphone access, especially under Snap confinement. Users report having to run manual `snap connect` commands to grant permissions.

### 2.3 Poor Desktop Integration

Existing clients use custom Electron dialogs for file operations instead of the system's native file picker (xdg-desktop-portal). This creates a jarring, non-native feel — a GTK user sees a Chromium file dialog instead of the GTK file chooser.

### 2.4 Theme Desync

Applications start in light mode regardless of the OS dark mode setting, and do not respond to real-time theme changes. Users must manually toggle themes inside the WhatsApp Web settings.

### 2.5 Font Rendering Inconsistency

Text rendering does not match the user's system font configuration, producing a visually inconsistent experience compared to native applications.

### 2.6 WhatsLNX Solution

WhatsLNX addresses every issue above by:
- Programmatically appending Wayland flags before app initialization.
- Auto-granting media permissions and pre-connecting Snap sandbox plugs.
- Routing all file operations through xdg-desktop-portal.
- Using Electron's `nativeTheme` API to detect and sync OS dark mode in real time via DOM injection.
- Respecting system font settings through CSS injection.

---

## 3. Target Audience

| Segment | Description |
|---------|-------------|
| **Linux desktop daily drivers** | Users who primarily use Linux and want a reliable WhatsApp client |
| **Wayland early adopters** | Users on GNOME/KDE Wayland sessions who need a crash-free experience |
| **Privacy-conscious users** | Users who prefer a minimal wrapper over running WhatsApp Web in a full browser |
| **System administrators** | Users who need native notifications and tray integration for workflow efficiency |
| **Accessibility-focused users** | Users who rely on OS-level theme sync and font scaling |

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Electron | Latest stable (currently 35.x+) |
| **Renderer** | Chromium (bundled with Electron) | 134+ |
| **Language** | JavaScript / TypeScript | Node.js 22+ |
| **Build Tool** | electron-builder | Latest stable |
| **State Persistence** | electron-store | Latest stable |
| **Package Formats** | AppImage, Snap, DEB | — |
| **CI/CD** | GitHub Actions | — |

### 4.2 Architecture Layers

```
┌─────────────────────────────────────────────────┐
│                  WhatsLNX App                    │
├─────────────────────────────────────────────────┤
│  main.js / main.ts    (Main Process)            │
│  ├── Window management (BrowserWindow)          │
│  ├── Permission handlers                        │
│  ├── Download interception                      │
│  ├── Theme sync (nativeTheme)                   │
│  ├── Single instance lock                       │
│  ├── System tray integration                    │
│  └── Wayland flag injection                     │
├─────────────────────────────────────────────────┤
│  preload.js / preload.ts  (Preload Layer)       │
│  ├── Theme DOM injection bridge                 │
│  ├── Notification interception bridge           │
│  ├── Font CSS injection                         │
│  └── IPC bridge (main ↔ renderer)              │
├─────────────────────────────────────────────────┤
│  WhatsApp Web  (web.whatsapp.com)               │
│  └── Loaded inside BrowserWindow webContents    │
└─────────────────────────────────────────────────┘
```

### 4.3 Process Model

- **Main process**: Manages window lifecycle, IPC, permissions, downloads, tray, theme.
- **Renderer process**: Loads `https://web.whatsapp.com` with `contextIsolation: true` and `nodeIntegration: false`.
- **Preload script**: Bridges theme and notification state between main and renderer via safe `contextBridge` APIs.

### 4.4 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| BrowserWindow over WebContentsView | Single-webview use case; BrowserWindow is simpler and fully supported. WebContentsView is for multi-view scenarios. |
| No heavy frontend framework | We wrap an existing web app — no React/Vue needed. Pure injected CSS/JS only. |
| Electron over Tauri | Tauri uses WebKitGTK which has known rendering and WebRTC bugs on Linux. Chromium (via Electron) has mature WebRTC support. |
| `contextIsolation: true` | Security best practice. Prevents WhatsApp page scripts from accessing Node.js APIs. |
| `nodeIntegration: false` | Security best practice. Renderer has no direct Node.js access. |

---

## 5. Functional Requirements

### 5.1 The Wrapper Engine

#### FR-1.1: Target URL Loading
- The application must load `https://web.whatsapp.com` as the sole web content.
- Must handle HTTPS exclusively — no HTTP fallback.

#### FR-1.2: User-Agent Spoofing
- The application must present a User-Agent string identifying as a standard Linux Chrome browser.
- Required format: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{CHROMIUM_VERSION}.0.0.0 Safari/537.36`
- The Chromium version in the UA string must be dynamically derived from the bundled Chromium version, not hardcoded, to prevent staleness.
- Rationale: WhatsApp Web blocks or limits features (including calling) when it detects non-standard or Electron-specific user agents.

#### FR-1.3: Session Persistence
- Login state, cookies, and local storage must persist across application restarts.
- Must use Electron's default session partition (no custom partition needed).
- Session data must be stored in the standard Electron `userData` directory (`~/.config/whatslnx/` on Linux).
- `electron-store` or equivalent must be used for user preferences (window size/position, theme preference override).

#### FR-1.4: Window State Persistence
- Window position, size, and maximized state must be remembered between sessions.
- Must gracefully handle display disconnection/reconnection (e.g., laptop dock/undock) by clamping window position to visible screen bounds.

### 5.2 Media & WebRTC (Audio/Video Calling)

#### FR-2.1: Automatic Media Permission Granting
- The main process must automatically approve `media` permission requests (camera and microphone) from the webview.
- The permission handler must use `session.defaultSession.setPermissionRequestHandler`.
- Allowed permissions: `media`, `notifications`, `geolocation`.
- Denied permissions: all others (e.g., `persistent-storage`, `midi`).
- Permission decisions must be logged for debugging purposes.

#### FR-2.2: Hardware Access Through Sandbox
- **AppImage**: Must access camera/microphone through standard OS device paths. No sandbox restrictions.
- **Snap**: Must declare and auto-connect the following plugs in `snapcraft.yaml`:
  ```yaml
  plugs:
    camera:
    audio-record:
    desktop:
    desktop-legacy:
    wayland:
    x11:
    unity7:
    network:
    network-bind:
    pulseaudio:
    opengl:
  ```
- Auto-connection must be requested via Snap store declaration so users do not need manual `snap connect` commands.
- **DEB**: No sandbox; hardware access works by default. Must verify udev rules do not block camera/mic access.

#### FR-2.3: WebRTC Compatibility
- Must test and verify that audio calls, video calls, and screen sharing work on:
  - GNOME Wayland (using PipeWire and xdg-desktop-portal)
  - KDE Plasma Wayland (using PipeWire and xdg-desktop-portal)
  - X11 sessions (using PulseAudio or PipeWire)
- Must set `--enable-features=WebRTCPipeWireCapturer` on Linux to enable PipeWire-based screen sharing under Wayland.

### 5.3 System Notifications

#### FR-3.1: Native Notification Bubbles
- Must intercept web notifications from WhatsApp Web and push them to the native Linux notification daemon via Electron's built-in `Notification` API (which uses DBus on Linux).
- Notification must include: sender name, message preview (truncated), and sender avatar where available.
- Clicking a notification must focus the WhatsLNX window and navigate to the relevant chat (if WhatsApp Web supports this via the notification click handler).

#### FR-3.2: Notification Sound
- Must play the WhatsApp notification sound through the system audio stack (PulseAudio/PipeWire).
- Must respect the system "Do Not Disturb" mode.

#### FR-3.3: Tray Icon
- Must display a system tray icon with the following behaviors:
  - **Left-click**: Show/focus the main window.
  - **Right-click**: Context menu with "Show Window", "Quit" options.
  - **Tooltip**: Display "WhatsLNX" and unread message count.
- Must support running minimized to tray (window closes but app stays in tray).
- Must show a visual badge or overlay on the tray icon when there are unread messages (if supported by the desktop environment).
- **Known limitation**: Linux tray icons have inconsistent behavior across desktop environments. Must test on GNOME (requires AppIndicator extension), KDE Plasma, and XFCE.

#### FR-3.4: Unread Badge Count
- Must read the page title from WhatsApp Web (format: `"({count}) WhatsApp"`) to extract unread message count.
- Must update the count in real-time by watching `document.title` changes via the preload script.
- Must update the tray icon tooltip and (where supported) the taskbar/dock badge with the count.

### 5.4 Download & Upload Handling

#### FR-4.1: Native Save Dialog for Downloads
- Must intercept the `will-download` event on the session.
- Must trigger the system's native save dialog (xdg-desktop-portal FileChooser) instead of saving silently to a default directory.
- If the user cancels the save dialog, the download must be cancelled.
- Download progress must not be shown in a custom UI — rely on the desktop environment's native download progress indicator (if any).

#### FR-4.2: Native File Picker for Uploads
- File upload dialogs triggered by WhatsApp Web must open the system's native file picker.
- Electron uses xdg-desktop-portal automatically on Linux when the GTK theme is set. Must verify this works correctly on GNOME and KDE.
- Must support multi-file selection where WhatsApp Web allows it.

### 5.5 URL Handling

#### FR-5.1: External Link Opening
- Links clicked inside WhatsApp Web must open in the user's default system browser, not inside the WhatsLNX window.
- Must intercept `new-window` events and use `shell.openExternal()` to delegate to the OS.

#### FR-5.2: WhatsApp Deep Links
- `whatsapp://` protocol links should be handled if feasible (stretch goal for v1.1).

---

## 6. OS Integration Requirements

### 6.1 Wayland Support

#### OIR-1.1: Automatic Wayland Flag Injection
- Must programmatically append the following Chromium flags at the absolute top of the main process entry point, before `app.whenReady()`:
  ```javascript
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
    app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,WebRTCPipeWireCapturer');
  }
  ```
- `ozone-platform-hint=auto` lets Chromium auto-detect Wayland vs X11 and use the appropriate backend.
- Must NOT hardcode `--ozone-platform=wayland` — this would break X11 sessions.
- Must test that window decorations (title bar, close/minimize/maximize buttons) render correctly under both GNOME Wayland and KDE Wayland.

#### OIR-1.2: X11 Fallback
- On X11 sessions, the app must function identically to the Wayland experience.
- No degradation in features, notifications, or media calling.

### 6.2 Dynamic Theming

#### OIR-2.1: System Theme Detection
- Must use Electron's `nativeTheme.shouldUseDarkColors` API to detect the current OS theme at startup.
- Must listen to `nativeTheme.on('updated')` to detect real-time theme changes (e.g., user toggles dark mode in GNOME Settings).

#### OIR-2.2: WhatsApp Web Theme Injection
- Must inject JavaScript into the WhatsApp Web DOM to toggle theme classes:
  - **Dark mode**: Set `document.body.classList.add('dark')` or change `'color-refresh'` to `'color-refresh-dark'` (whichever is current for the WhatsApp Web version).
  - **Light mode**: Remove the `'dark'` class or revert to `'color-refresh'`.
- Must perform theme injection:
  1. On initial page load (after DOM ready).
  2. On every OS theme change event.
  3. On WhatsApp Web navigation/page reload.
- Must use a MutationObserver to re-apply the theme if WhatsApp Web's internal logic overrides it.

#### OIR-2.3: Theme Preference Override
- Users must be able to override automatic theme detection via a settings option:
  - **System** (default): Follows OS theme.
  - **Light**: Forces light mode regardless of OS setting.
  - **Dark**: Forces dark mode regardless of OS setting.
- The override must be persisted via `electron-store`.

### 6.3 Font Rendering

#### OIR-3.1: System Font Respect
- Must inject CSS to match the system's default font family and rendering settings.
- Must read the system font from GTK/Qt settings where possible.
- Must not override WhatsApp Web's own font sizing — only the font family and antialiasing.

### 6.4 Spell Check

#### OIR-4.1: System Spell Checker
- Must use Electron's built-in spell checker with the user's system language.
- Must NOT bundle Hunspell dictionaries — use system dictionaries to keep package size small.

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Cold startup time | ≤ 2 seconds (window visible) | Time from process spawn to `did-finish-load` event |
| Memory usage (idle) | ≤ 150 MB RSS | Measured via `process.memoryMetrics()` or `/proc/{pid}/status` |
| Memory usage (active chat) | ≤ 250 MB RSS | Same measurement during active messaging |
| CPU usage (idle, background) | ≤ 1% | Measured via `top` / `htop` |
| Memory comparison | < Chrome tab running web.whatsapp.com | Side-by-side comparison |

### 7.2 Reliability

- **NFR-2.1**: Single instance lock — must use `app.requestSingleInstanceLock()`. If a second instance is launched, it must focus the existing window and exit.
- **NFR-2.2**: Must handle network disconnections gracefully — show WhatsApp Web's built-in "connecting" indicator without crashing.
- **NFR-2.3**: Must handle GPU process crashes — Electron's `app.relaunch()` or window recreation.
- **NFR-2.4**: Must handle suspend/resume without losing session or requiring re-login.

### 7.3 Security

- **NFR-3.1**: `contextIsolation: true` — mandatory, no exceptions.
- **NFR-3.2**: `nodeIntegration: false` — mandatory, no exceptions.
- **NFR-3.3**: `sandbox: true` for the renderer process.
- **NFR-3.4**: Must use `https://` exclusively for all loaded content.
- **NFR-3.5**: Must validate that navigation stays within `web.whatsapp.com` domain. Block or warn on unexpected redirects.
- **NFR-3.6**: Preload script must use `contextBridge` to expose only minimal, vetted APIs.
- **NFR-3.7**: Must not store or transmit WhatsApp credentials, session tokens, or messages to any third-party service.

### 7.4 Accessibility

- **NFR-4.1**: Must support screen readers via Chromium's accessibility tree.
- **NFR-4.2**: Must respect system-level high contrast modes.
- **NFR-4.3**: Must support keyboard navigation (Tab, Enter, Escape) for all custom UI elements (tray menu, any settings dialogs).

### 7.5 Startup Behavior

- **NFR-5.1**: The app must render the window within 2 seconds of the user clicking the desktop icon.
- **NFR-5.2**: If a saved session exists, the user must see their chats immediately (no re-scan of QR code).
- **NFR-5.3**: If no saved session exists, the QR code login screen must appear within the 2-second window.

---

## 8. Packaging & Distribution

### 8.1 AppImage (Primary Portable Release)

- **Purpose**: Universal, install-free execution on any Linux distribution.
- **Configuration**: electron-builder `linux.target: "AppImage"`.
- **Must include**: Application icon, `.desktop` file, AppStream metadata.
- **Auto-update**: Must support electron-updater for AppImage releases via GitHub Releases.
- **Size target**: ≤ 80 MB.

### 8.2 Snap Package

- **Purpose**: Ubuntu Software Center distribution with sandboxed permissions.
- **Configuration**: electron-builder `linux.target: "snap"`.
- **Required plugs** (must be auto-connected):
  ```yaml
  plugs:
    camera:
    audio-record:
    desktop:
    desktop-legacy:
    wayland:
    x11:
    unity7:
    network:
    network-bind:
    pulseaudio:
    opengl:
    home:
  ```
- **Auto-connection**: Must submit a snap declaration to the Snap Store to auto-connect `camera` and `audio-record` plugs. Without this, users would need to run `snap connect whatslnx:camera` manually.
- **Confinement**: `strict` (default for Snap Store). Must not use `devmode` or `classic`.
- **Size target**: ≤ 100 MB.

### 8.3 Debian Package (.deb)

- **Purpose**: Native integration on Ubuntu/Debian/Linux Mint/Elementary OS.
- **Configuration**: electron-builder `linux.target: "deb"`.
- **Dependencies**: Must declare `libnotify4`, `libxtst6`, `libnss3`, `libxss1`, `libasound2` as dependencies.
- **Categories**: `Network;InstantMessaging;Chat;`.
- **Size target**: ≤ 70 MB.

### 8.4 Application Metadata

All packages must include:
- **AppStream metadata** (`whatslnx.appdata.xml`): For software center discoverability.
- **Desktop entry** (`whatslnx.desktop`): With proper `Name`, `Comment`, `Icon`, `Categories`, `StartupWMClass`.
- **Application icon**: SVG and PNG formats in standard sizes (16, 24, 32, 48, 64, 128, 256, 512).
- **MIME types**: `x-scheme-handler/whatsapp` (for future deep link support).

### 8.5 Code Signing

- **AppImage**: Optional but recommended. Use GPG signing.
- **Snap**: Snap Store handles signing.
- **DEB**: Optional. Use `dpkg-sig` if signing.

---

## 9. User Interface Specification

### 9.1 Main Window

| Property | Value |
|----------|-------|
| Default width | 1100px |
| Default height | 750px |
| Minimum width | 400px |
| Minimum height | 500px |
| Title bar text | "WhatsLNX" |
| Icon | Custom WhatsLNX icon |
| Background color | Matches current theme (dark: `#1a1a1a`, light: `#ffffff`) — prevents white flash on startup |

### 9.2 Tray Menu Items

| Item | Action |
|------|--------|
| Show/Hide WhatsLNX | Toggle main window visibility |
| --- (separator) | --- |
| Quit | Fully quit the application (not just close window) |

### 9.3 Custom UI Elements

WhatsLNX must NOT add any custom UI overlays, toolbars, sidebars, or panels to the WhatsApp Web interface. The entire visual experience must be unmodified WhatsApp Web content.

**Exceptions** (only if needed):
- A minimal "loading" splash screen before WhatsApp Web finishes loading.
- A settings window (opened via tray menu or keyboard shortcut) for theme override preference — this must be a separate Electron window, not injected into the WhatsApp Web content.

---

## 10. Security Considerations

### 10.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| WhatsApp Web XSS could escape the wrapper | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` |
| Malicious redirect to phishing site | Validate all navigations against `web.whatsapp.com` whitelist |
| Credential theft by the wrapper | The wrapper does NOT read, store, or transmit WhatsApp credentials. Session data stays in Electron's standard `userData` directory. |
| Tampered packages | GPG-sign AppImage, publish Snap through verified store account, publish DEB via GitHub Releases with checksums |
| Supply chain attacks in dependencies | Pin all dependency versions, use `npm audit` in CI, review lockfile changes |

### 10.2 Data Handling

- **Cookies/Local Storage**: Stored in `~/.config/whatslnx/` (or Snap's equivalent path). Never exported or transmitted.
- **User preferences**: Stored via `electron-store` in the same `userData` directory. Not encrypted (theme preference is not sensitive).
- **Cache**: Stored in standard Electron cache directory. Cleared on uninstall.
- **No telemetry**: WhatsLNX must NOT collect or transmit any usage data, analytics, or crash reports.

---

## 11. Testing Strategy

### 11.1 Manual Test Matrix

| Test Case | GNOME Wayland | GNOME X11 | KDE Wayland | KDE X11 | XFCE X11 |
|-----------|:---:|:---:|:---:|:---:|:---:|
| App launches within 2s | ☐ | ☐ | ☐ | ☐ | ☐ |
| QR code scan + login | ☐ | ☐ | ☐ | ☐ | ☐ |
| Session persists after restart | ☐ | ☐ | ☐ | ☐ | ☐ |
| Audio call works | ☐ | ☐ | ☐ | ☐ | ☐ |
| Video call works | ☐ | ☐ | ☐ | ☐ | ☐ |
| Screen share works | ☐ | ☐ | — | — | — |
| Native notification appears | ☐ | ☐ | ☐ | ☐ | ☐ |
| Dark mode auto-sync | ☐ | ☐ | ☐ | ☐ | ☐ |
| Native file picker opens | ☐ | ☐ | ☐ | ☐ | ☐ |
| Download triggers native save dialog | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tray icon visible + functional | ☐ | ☐ | ☐ | ☐ | ☐ |
| Unread badge count accurate | ☐ | ☐ | ☐ | ☐ | ☐ |
| Second instance focuses existing | ☐ | ☐ | ☐ | ☐ | ☐ |
| Links open in default browser | ☐ | ☐ | ☐ | ☐ | ☐ |
| Window state persists | ☐ | ☐ | ☐ | ☐ | ☐ |

### 11.2 Per-Package Testing

| Test Case | AppImage | Snap | DEB |
|-----------|:---:|:---:|:---:|
| Clean install | ☐ | ☐ | ☐ |
| Clean uninstall (no leftover files) | ☐ | ☐ | ☐ |
| Upgrade from previous version | ☐ | ☐ | ☐ |
| Camera/mic work without manual config | ☐ | ☐ | ☐ |
| Appears in application menu | ☐ | ☐ | ☐ |
| Appears in GNOME Software / KDE Discover | — | ☐ | — |

### 11.3 Automated Testing

- **Unit tests**: For utility functions (theme injection logic, unread count parsing, permission handler logic).
- **Integration tests**: Using Spectron or Playwright for Electron to verify window creation, URL loading, and basic DOM interactions.
- **CI pipeline**: GitHub Actions running on `ubuntu-latest` with:
  1. `npm ci`
  2. `npm test` (unit + integration)
  3. `npm run lint`
  4. `npm run build:linux` (all three package formats)
  5. Upload build artifacts

---

## 12. Release Phases

### Phase 1: MVP (v0.1.0)

**Goal**: A working wrapper that loads WhatsApp Web with session persistence.

- [ ] Electron app loads `https://web.whatsapp.com`
- [ ] User-Agent spoofing
- [ ] Session persistence (cookies, local storage)
- [ ] Single instance lock
- [ ] Wayland flags injected
- [ ] Window state persistence
- [ ] Basic tray icon (show/hide/quit)
- [ ] Links open in default browser
- [ ] AppImage build

### Phase 2: Native Integration (v0.2.0)

**Goal**: Full desktop integration.

- [ ] Automatic media permission granting
- [ ] Native notification bubbles
- [ ] Dark/light theme sync with OS
- [ ] Native file picker for uploads
- [ ] Native save dialog for downloads
- [ ] Unread badge count in tray/page title
- [ ] Snap package with auto-connected plugs
- [ ] DEB package

### Phase 3: Polish & Distribution (v1.0.0)

**Goal**: Production-ready release.

- [ ] Audio/video calling verified on all target DEs
- [ ] Screen sharing via PipeWire on Wayland
- [ ] Theme preference override (system/light/dark)
- [ ] Font rendering sync
- [ ] AppStream metadata
- [ ] Application icon (all sizes)
- [ ] Splash screen on startup
- [ ] Auto-update support (AppImage)
- [ ] Published to Snap Store
- [ ] Published to GitHub Releases
- [ ] Complete test matrix (all cells checked)
- [ ] README with installation instructions

### Phase 4: Enhancements (v1.x)

- [ ] Spell checker integration
- [ ] Keyboard shortcuts (global hotkeys for mute, etc.)
- [ ] `whatsapp://` protocol handler
- [ ] Flatpak package (if demand exists)
- [ ] MPRIS integration for voice message playback
- [ ] Custom CSS injection for user theming

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| App launches within 2 seconds | 95% of cold starts |
| Memory usage (idle) | ≤ 150 MB RSS |
| Audio/video call success rate | ≥ 95% on tested configurations |
| Wayland crash rate | Zero segfaults on GNOME/KDE Wayland |
| Theme sync latency | ≤ 500ms from OS theme change to visual update |
| Snap permission issues | Zero manual `snap connect` commands needed |
| User reports of "non-native feel" | Minimal (subjective, tracked via GitHub issues) |

---

## 14. Risks & Mitigations

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| WhatsApp Web blocks Electron user agents | High | Medium | User-Agent spoofing mimics standard Chrome. Monitor and update UA string with each release. |
| WhatsApp Web changes DOM structure, breaking theme injection | Medium | Medium | Use MutationObserver to re-apply. Monitor WhatsApp Web updates. Fall back to `prefers-color-scheme` CSS media query. |
| Snap Store rejects auto-connect declaration for camera/mic | High | Low | Provide clear documentation for manual `snap connect` as fallback. Offer AppImage as alternative. |
| Electron security vulnerability | High | Low | Pin to latest stable Electron. Use GitHub Dependabot for automated security updates. |
| GNOME removes tray icon support entirely | Medium | Medium | Already requires AppIndicator extension. Document this requirement. Consider alternative approaches (e.g., GNOME Extension). |
| WhatsApp Web changes URL structure | Medium | Low | Make URL configurable. Monitor for changes. |
| PipeWire/xdg-desktop-portal not installed on user's system | Medium | Low (modern distros) | Document as requirement. AppImage/DEB dependencies should not enforce this (it's optional for screen share only). |
| High memory usage on par with Chrome tab | Medium | Medium | Profile and optimize. Use `webContents.setBackgroundThrottling(false)` only when needed. Aggressively GC on minimize. |

---

## Appendix A: Competitive Analysis

| Feature | WhatsLNX (planned) | Whatsdesk | Whatsie | WhatsApp for Linux |
|---------|:---:|:---:|:---:|:---:|
| Framework | Electron | Electron | Qt WebEngine | GTK + WebKit |
| Wayland support | Auto-detected | Manual flags needed | Partial | Unknown |
| WebRTC calling | Auto-permission | Broken in Snap | Works | Unknown |
| Native file dialogs | xdg-desktop-portal | Custom Electron | Custom | Custom |
| Theme sync | Auto (nativeTheme) | Manual | Manual | Manual |
| Snap auto-connect | Planned | Not configured | N/A | N/A |
| Session persistence | Yes | Yes | Yes | Yes |
| Tray icon | Yes | Yes | Yes | Yes |
| Unread badge | Yes | No | Yes | No |
| Auto-update | Yes | No | No | No |
| Font sync | Yes | No | No | No |

---

## Appendix B: Technical References

### Electron APIs Used

| API | Purpose |
|-----|---------|
| `app.requestSingleInstanceLock()` | Prevent multiple instances |
| `app.commandLine.appendSwitch()` | Inject Wayland flags |
| `BrowserWindow` | Main window management |
| `session.defaultSession.setPermissionRequestHandler()` | Auto-grant media permissions |
| `session.defaultSession.on('will-download')` | Intercept downloads |
| `nativeTheme.shouldUseDarkColors` | Detect OS dark mode |
| `nativeTheme.on('updated')` | Listen for theme changes |
| `Tray` | System tray icon and menu |
| `shell.openExternal()` | Open links in default browser |
| `Notification` | Native system notifications |
| `contextBridge` | Safe IPC between main and renderer |
| `webContents.executeJavaScript()` | Theme injection into WhatsApp DOM |
| `electron-store` | Persist user preferences |

### Key Chromium Flags for Linux

| Flag | Purpose |
|------|---------|
| `--ozone-platform-hint=auto` | Auto-detect Wayland vs X11 |
| `--enable-features=WaylandWindowDecorations` | Native window decorations on Wayland |
| `--enable-features=WebRTCPipeWireCapturer` | Screen sharing via PipeWire on Wayland |

### Snap Interfaces Required

| Interface | Purpose | Auto-connect |
|-----------|---------|:---:|
| `camera` | Webcam access for video calls | Yes (needs store declaration) |
| `audio-record` | Microphone access for voice calls | Yes (needs store declaration) |
| `pulseaudio` | Audio playback | Yes |
| `wayland` | Wayland compositor access | Yes |
| `x11` | X11 fallback | Yes |
| `desktop` | Desktop integration | Yes |
| `network` | Internet access for WhatsApp Web | Yes |
| `opengl` | Hardware acceleration | Yes |
| `home` | Access to home directory for downloads | Yes |

### Sources

- [Electron 35.0.0 Release Notes](https://electronjs.org/blog/electron-35-0)
- [Electron Wayland Support](https://electronjs.org/blog/tech-talk-wayland)
- [Electron Dark Mode Tutorial](https://electronjs.org/docs/latest/tutorial/dark-mode)
- [Electron nativeTheme API](https://electronjs.org/docs/latest/api/native-theme)
- [Electron Snapcraft Guide](https://electronjs.org/docs/latest/tutorial/snapcraft)
- [electron-builder Snap Documentation](https://www.electron.build/snap.html)
- [WebRTC Wayland Screen Sharing (PipeWire)](https://jgrulich.cz/2022/02/16/webrtc-journey-to-make-wayland-screen-sharing-enabled-by-default/)
- [xdg-desktop-portal Documentation](https://flatpak.github.io/xdg-desktop-portal/)
- [Electron Issue #2911: Native File Picker](https://github.com/electron/electron/issues/2911)
- [Electron Issue #29115: PipeWire WebRTC](https://github.com/electron/electron/issues/29115)
