# WhatsLNX PRD Completeness Report

**Date:** 2026-05-25
**Analyzed against:** `docs/PRD.md` v1.0.0 (2026-05-24)
**Project version:** `0.1.0` (package.json)
**Branch:** `feature/add-badgecount-in-launcher-and-dock`

---

## Executive Summary

The WhatsLNX codebase implements **~85%** of PRD requirements across Phase 1 (MVP) and Phase 2 (Native Integration). The core wrapper engine, desktop integration, notifications, theming, font configuration, packaging pipeline, and CI/CD are all functional. Several gaps exist in non-functional requirements (security hardening, crash recovery, automated testing) and Snap configuration fidelity.

**Overall status:** Functional but needs hardening before v1.0 release.

---

## 1. Phase 1 (MVP v0.1.0) — Complete

| Requirement | Status | Location | Notes |
|---|---|---|---|
| Load `https://web.whatsapp.com` | DONE | `src/main.js:14,195` | HTTPS only, no HTTP fallback |
| User-Agent spoofing | DONE | `src/main.js:15-19` | Chromium version dynamically derived from `process.versions.chrome` |
| Session persistence | DONE | Default Electron session | Data stored in `~/.config/whatslnx/` via `electron-store` |
| Single instance lock | DONE | `src/main.js:41-58` | `app.requestSingleInstanceLock()`, second instance focuses existing + forwards deep link |
| Wayland flag injection | DONE | `src/main.js:27-31` | `ozone-platform-hint=auto`, `WaylandWindowDecorations`, `WebRTCPipeWireCapturer` |
| Window state persistence | DONE | `src/main.js:86-93,168-171,244-250` | Bounds, position, maximized state saved via `electron-store` |
| Basic tray icon | DONE | `src/tray.js:177-288` | Show/hide, quit, click-to-toggle |
| Links open in default browser | DONE | `src/main.js:221-234` | `setWindowOpenHandler` + `will-navigate` guard with `shell.openExternal` |
| `whatsapp://` deep link handler | DONE | `src/main.js:33-80` | Cold start (`process.argv`) + warm start (`second-instance` event), `setAsDefaultProtocolClient` |
| AppImage build | DONE | `electron-builder.yml:16-18` | + auto-update via `electron-updater` |

**Phase 1 verdict: 10/10 requirements implemented.**

---

## 2. Phase 2 (Native Integration v0.2.0) — Mostly Complete

| Requirement | Status | Location | Notes |
|---|---|---|---|
| Auto media permission granting | DONE | `src/main.js:103-106` | Allows `media`, `notifications`, `geolocation`, `display-capture` |
| Native notification bubbles | DONE | `src/notifications.js`, `src/preload.js:79-114` | Intercepts WA Web `Notification` + Service Worker `showNotification`, resolves remote icons |
| Theme passthrough | DONE | `src/main.js:97` | `nativeTheme.themeSource` set from store; no manual DOM injection — WA Web's `prefers-color-scheme` works natively |
| Theme override (system/light/dark) | DONE | `src/tray.js:262-277`, `src/settings.js:70-74` | Radio buttons in tray menu AND settings window |
| Native file picker for uploads | DONE | Default Electron behavior | Electron uses xdg-desktop-portal on Linux automatically |
| Native save dialog for downloads | DONE | `src/main.js:142-154` | `will-download` intercepted, `dialog.showSaveDialogSync` used |
| Drag-and-drop file support | DONE | Default Electron behavior | No custom handling needed — BrowserWindow supports DnD natively |
| Unread badge count | DONE | `src/main.js:198-211`, `src/preload.js:4-43`, `src/tray.js:80-155` | Title parsing, MutationObserver, tray badge rendering (pixel font PNG), `app.setBadgeCount()` |
| Settings window + font config | DONE | `src/settings.js`, `src/settings.html` | Serif/Sans-Serif/Monospace dropdowns, `fc-list` system fonts, Reset to Default, CSS injection via IPC |
| Snap package | DONE | `electron-builder.yml:37-62` | **Gaps: missing content plugs, `classic` confinement** (see Issues) |
| DEB package | DONE | `electron-builder.yml:64-72` | Correct dependencies, post-install/remove scripts for `update-desktop-database` |

**Phase 2 verdict: 11/11 features implemented, 2 with gaps.**

---

## 3. Phase 3 (Polish v1.0.0) — Partial

| Requirement | Status | Location | Notes |
|---|---|---|---|
| Audio/video calling infrastructure | DONE | Permissions + Wayland flags + PipeWire | Actual verification requires manual testing per DE |
| Screen sharing via PipeWire | DONE | `src/main.js:108-139` | `setDisplayMediaRequestHandler` with 5-min cache, `desktopCapturer` sources |
| AppStream metadata | DONE | `assets/whatslnx.appdata.xml` | Complete with screenshots, OARS rating, release history |
| Application icon (all sizes) | DONE | `assets/icons/` | 16, 24, 32, 48, 64, 128, 256, 512 PNG + SVG |
| Auto-update (AppImage) | DONE | `src/updater.js` | 4-hour poll cycle, notification on available/downloaded |
| GitHub Releases CI/CD | DONE | `.github/workflows/release.yml` | Build + publish on push to `main` |
| Published to Snap Store | N/A | — | Deployment action, not code |
| Complete test matrix | NOT DONE | — | No test files exist |
| README with installation instructions | DONE | `README.md` | Exists (not re-verified for completeness) |

**Phase 3 verdict: 7/9 done (2 require manual/external action).**

---

## 4. Issues Found

### Critical

#### C1: Settings window disables security best practices
- **File:** `src/settings.js:42-44`
- **Code:** `nodeIntegration: true, contextIsolation: false`
- **PRD ref:** NFR-3.1 (`contextIsolation: true` — "mandatory, no exceptions"), NFR-3.2
- **Impact:** Settings window loads `settings.html` with full Node.js access. While it's a local HTML file (no remote content), this violates the PRD's stated security posture.
- **Fix:** Refactor `settings.html` to use `contextBridge` + IPC like the main window. Use `ipcRenderer.invoke` via preload script instead of direct `require('electron')`.

#### C2: Snap confinement is `classic` instead of `strict`
- **File:** `electron-builder.yml:38`
- **Code:** `confinement: classic`
- **PRD ref:** Section 8.2 — "Confinement: `strict` (default for Snap Store). Must not use `devmode` or `classic`."
- **Impact:** Classic confinement defeats the purpose of Snap sandboxing. The Snap Store may reject the package or flag it.
- **Note:** This may be a pragmatic choice — Electron under strict confinement requires complex plug configuration and may break. The `ELECTRON_DISABLE_SANDBOX` flag at `main.js:4` and `--no-sandbox` at `main.js:28` suggest known compatibility issues.
- **Fix:** Test under `strict` confinement. If sandbox issues persist, document the deviation in the PRD.

#### C3: No automated tests
- **Files:** None — no `test/` directory, no test framework in dependencies
- **PRD ref:** Section 11.3 — "Unit tests: For utility functions (theme injection logic, unread count parsing, permission handler logic). Integration tests: Using Spectron or Playwright for Electron."
- **Impact:** CI pipeline (`ci.yml`) only runs lint + build. `npm test` script doesn't exist in `package.json`.
- **Fix:** Add test framework, write unit tests for badge parsing (`tray.js` glyph logic), permission handler, font CSS generation. Add `npm test` to CI.

---

### Moderate

#### M1: Snap missing content plugs for theme integration
- **File:** `electron-builder.yml:40-60`
- **PRD ref:** Section 8.2, FR-2.2 — requires `gtk-2-themes`, `gtk-3-themes`, `icon-themes`, `sound-themes` content plugs
- **Current:** Only standard plugs listed. No content plugs for `gtk-common-themes`.
- **Impact:** Snap package may not respect system GTK/icon/sound themes under strict confinement. Under `classic` confinement this is moot (full filesystem access).
- **Fix:** Add content plugs if moving to `strict` confinement:
  ```yaml
  plugs:
    gtk-2-themes: null
    gtk-3-themes: null
    icon-themes: null
    sound-themes: null
  ```

#### M2: No permission decision logging
- **File:** `src/main.js:103-106`
- **PRD ref:** FR-2.1 — "Permission decisions must be logged for debugging purposes."
- **Current:** Silent allow/deny with no logging.
- **Fix:** Add `console.log('[permission]', permission, allowed ? 'granted' : 'denied');`

#### M3: No GPU process crash recovery
- **PRD ref:** NFR-2.3 — "Must handle GPU process crashes — Electron's `app.relaunch()` or window recreation."
- **Current:** Not implemented.
- **Fix:** Add `app.on('render-process-gone', ...)` and `app.on('child-process-gone', ...)` handlers.

#### M4: No window position clamping on display change
- **File:** `src/main.js:170,178-179`
- **PRD ref:** FR-1.4 — "Must gracefully handle display disconnection/reconnection by clamping window position to visible screen bounds."
- **Current:** Restores saved `x, y` without checking if coordinates are within any screen's bounds.
- **Impact:** Window may appear off-screen after undocking a laptop from external monitor.
- **Fix:** After restoring position, check against `screen.getAllDisplays()` and clamp if needed.

#### M5: appId inconsistency
- **Files:** `electron-builder.yml:1` (`com.whatslnx.app`) vs `io.github.kmmuntasir.WhatsLNX.yml` (`io.github.kmmuntasir.WhatsLNX`) vs `src/main.js:41` (`io.github.kmmuntasir.WhatsLNX`)
- **Impact:** Desktop file may use wrong app ID. Flatpak manifest remaps correctly, but AppImage/DEB/Snap may use the wrong ID for D-Bus activation, notification identity, or desktop integration.
- **Fix:** Standardize on `io.github.kmmuntasir.WhatsLNX` everywhere, or document the split.

#### M6: `test` script missing from package.json
- **File:** `package.json` — no `"test"` script
- **PRD ref:** Section 11.3 — CI must run `npm test`
- **Fix:** Add `"test": "echo 'no tests yet' && exit 0"` as placeholder, then replace with actual test runner.

---

### Low

#### L1: Flatpak support exists but not in PRD Phase 1-3
- **Files:** `io.github.kmmuntasir.WhatsLNX.yml`, `electron-builder.yml:25-26,77-100`
- **PRD ref:** Phase 4 — "Flatpak package (if demand exists)"
- **Status:** Already implemented ahead of schedule. Not an issue, just ahead of PRD.

#### L2: `display-capture` permission allowed but not in PRD list
- **File:** `src/main.js:104`
- **PRD ref:** FR-2.1 — allowed list: `media`, `notifications`, `geolocation`
- **Impact:** Positive — needed for screen sharing to work. PRD list is incomplete.
- **Fix:** Update PRD to include `display-capture`.

#### L3: `no-sandbox` Chromium flag on Linux
- **File:** `src/main.js:28`
- **Impact:** Disables Chromium's SUID sandbox. Electron's renderer sandbox (`sandbox: true` in webPreferences) is still active. Required for Snap/Flatpak where SUID binary isn't available.

#### L4: PRD references Electron 35.x+ but project uses 42.x
- **File:** `package.json:33` — `"electron": "^42.2.0"`
- **Impact:** None — 42.x is newer. PRD's "currently 35.x+" was written at an earlier date.

#### L5: Tray behavior differs slightly from PRD
- **PRD ref:** FR-3.3 — "Left-click: Show/focus the main window. Right-click: Context menu."
- **Current:** `tray.js:197-208` — Left click toggles visibility (hide if focused+visible, show if hidden). Right-click opens context menu.
- **Impact:** Toggle behavior is arguably better UX than PRD spec.

---

## 5. Non-Functional Requirements Checklist

| NFR | Status | Notes |
|---|---|---|
| NFR-3.1: `contextIsolation: true` | PARTIAL | Main window: yes. Settings window: **no** (C1) |
| NFR-3.2: `nodeIntegration: false` | PARTIAL | Main window: yes. Settings window: **no** (C1) |
| NFR-3.3: `sandbox: true` renderer | DONE | `main.js:188` |
| NFR-3.4: HTTPS only | DONE | Hardcoded `https://web.whatsapp.com` |
| NFR-3.5: Navigation validation | DONE | `main.js:229-234` — blocks non-whatsapp.com navigations |
| NFR-3.6: `contextBridge` minimal API | DONE | `preload.js:3-51` — only `onTitleChange`, `getUnreadCount`, `send` |
| NFR-3.7: No credential storage/transmission | DONE | No code reads/transmits WhatsApp data |
| NFR-2.1: Single instance lock | DONE | `main.js:41-58` |
| NFR-2.2: Network disconnection handling | DONE | WA Web's built-in reconnect UI |
| NFR-2.3: GPU crash recovery | MISSING | (M3) |
| NFR-2.4: Suspend/resume | PARTIAL | Electron handles by default; no explicit handling |

---

## 6. OS Integration Requirements Checklist

| OIR | Status | Notes |
|---|---|---|
| OIR-1.1: Wayland flag injection | DONE | `ozone-platform-hint=auto`, not hardcoded `wayland` |
| OIR-1.2: X11 fallback | DONE | `auto` hint enables seamless fallback |
| OIR-2.1: Theme passthrough | DONE | `nativeTheme` used, no manual DOM class injection |
| OIR-2.2: Theme override | DONE | Tray menu + settings window, persisted via `electron-store` |
| OIR-3.1: User-configurable fonts | DONE | Serif/Sans-Serif/Monospace via `fc-list`, CSS injection |
| OIR-3.2: Font settings UI | DONE | Settings window with dropdowns, immediate application |
| OIR-4.1: System spell checker | NOT DONE | Phase 4 per PRD — correctly deferred |

---

## 7. Packaging & Distribution Checklist

| Item | Status | Notes |
|---|---|---|
| AppImage build | DONE | electron-builder config + auto-update |
| Snap package | DONE (gaps) | Missing content plugs, `classic` not `strict` (C2, M1) |
| DEB package | DONE | Correct dependencies, post-install/remove scripts |
| Flatpak | DONE (bonus) | Ahead of PRD schedule (Phase 4) |
| AppStream metadata | DONE | Complete with releases, OARS, keywords |
| Desktop entry | DONE | Proper Name, Categories, StartupWMClass, MimeType |
| Icon sizes (16-512 + SVG) | DONE | All 8 PNG sizes + SVG |
| `whatsapp://` MIME type | DONE | In desktop entry + post-install script |
| Code signing | NOT DONE | PRD says optional; not blocking |
| GitHub Actions CI | DONE | Lint + build on `develop`, publish on `main` |

---

## 8. Architecture Fidelity

| PRD Layer | Implementation | Match |
|---|---|---|
| Main process: window management | `main.js` BrowserWindow | Exact |
| Main process: permission handlers | `main.js:103-106` | Exact |
| Main process: download interception | `main.js:142-154` | Exact |
| Main process: theme sync | `main.js:96-97` + `tray.js:262-277` | Exact |
| Main process: single instance | `main.js:41-58` | Exact |
| Main process: system tray | `tray.js` | Exact |
| Main process: Wayland flags | `main.js:27-31` | Exact |
| Preload: theme passthrough | Default Electron behavior | Exact (no manual injection) |
| Preload: notification bridge | `preload.js:79-114` | Exceeds — also handles Service Worker |
| Preload: font CSS injection | `preload.js:56-75` | Exact |
| Preload: IPC bridge | `preload.js:45-51` | Exact |
| WhatsApp Web loaded in BrowserWindow | `main.js:195` | Exact |

---

## 9. Scorecard

| Category | Total | Done | Partial | Missing | % Complete |
|---|---|---|---|---|---|
| Phase 1 (MVP) | 10 | 10 | 0 | 0 | 100% |
| Phase 2 (Native Integration) | 11 | 9 | 2 | 0 | 91% |
| Phase 3 (Polish) | 9 | 7 | 0 | 2 | 78% |
| Non-Functional Requirements | 11 | 8 | 2 | 1 | 82% |
| OS Integration | 7 | 6 | 0 | 1 | 86% |
| Packaging & Distribution | 10 | 8 | 1 | 1 | 85% |
| **Overall** | **58** | **48** | **5** | **5** | **~87%** |

---

## 10. Recommended Priority Actions

1. **Fix settings window security** (C1) — refactor to use `contextBridge` + preload
2. **Resolve Snap confinement** (C2) — test under `strict`, add content plugs (M1)
3. **Add automated tests** (C3) — even basic unit tests for badge parsing and permission logic
4. **Add GPU crash recovery** (M3) — `render-process-gone` / `child-process-gone` handlers
5. **Add window position clamping** (M4) — prevent off-screen window on display change
6. **Standardize appId** (M5) — pick one ID, use everywhere
7. **Add permission logging** (M2) — single `console.log` line

---

*Report generated by automated PRD-vs-codebase analysis. Manual testing results and runtime behavior are not reflected here.*
