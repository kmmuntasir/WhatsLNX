# Plan: Remove Snap and Flatpak Support

**Goal**: Strip all Snap and Flatpak code, config, docs, and artifacts. Keep only AppImage + Deb.

**Note**: This is not permanent. Snap and Flatpak support will be restored in a future release once we have the bandwidth to test and maintain all four formats properly. The Flatpak manifest (`io.github.kmmuntasir.WhatsLNX.yml`), Snap config, and related docs should be recoverable from git history when we're ready to re-add them.

---

## Step 1 — Delete Flatpak-specific files

These files exist solely for Flatpak and have no use without it:

- [ ] `io.github.kmmuntasir.WhatsLNX.yml` — Flatpak manifest
- [ ] `generated-sources.json` — Flatpak npm cache sources (18.8K, unused without manifest)
- [ ] `assets/whatslnx.appdata.xml` — AppStream metadata used by Flatpak store

## Step 2 — Remove snap/flatpak targets from `electron-builder.yml`

Remove lines 22-27 (snap + flatpak targets) and lines 37-62 (snap config) and lines 77-101 (flatpak config).

File becomes: AppImage target + deb target + deb config + appImage config + publish config. No afterPack needed either (see step 4).

- [ ] Delete lines 22-27 (snap + flatpak targets under `linux.target`)
- [ ] Delete lines 37-62 (entire `snap:` section)
- [ ] Delete lines 77-101 (entire `flatpak:` section)

## Step 3 — Remove npm scripts from `package.json`

- [ ] Delete `"build:snap": "electron-builder --linux snap"` (line 23)
- [ ] Delete `"build:flatpak": "electron-builder --linux flatpak"` (line 25)

## Step 4 — Simplify `scripts/afterPack.js`

Current logic: detects snap/flatpak and branches. After removal, only AppImage/deb remain.

The snap branch (lines 18-35) patches snap templates — delete entirely.
The flatpak branch (lines 37-40) short-circuits for zypak — delete entirely.
Remaining: chrome-sandbox removal + `--no-sandbox` wrapper for AppImage/deb.

- [ ] Remove `isSnap` and `isFlatpak` variables (lines 8-9)
- [ ] Remove snap template patching block (lines 18-35)
- [ ] Remove flatpak early-return block (lines 37-40)
- [ ] Keep chrome-sandbox removal + `--no-sandbox` wrapper logic (lines 11-16, 42-64)

## Step 5 — Remove Snap runtime code from `src/tray.js`

Lines 162-165 detect `process.env.SNAP` and add a snap-specific icon path.

- [ ] Remove comment `// Snap installs the icon to meta/gui — use absolute path as fallback` (line 162)
- [ ] Remove `if (process.env.SNAP) { ... }` block (lines 163-165)

## Step 6 — Update comment in `src/main.js`

Line 1 says `needed for snap`. Sandbox disable is still needed for AppImage/deb.

- [ ] Change line 1 comment from `// Set ELECTRON_DISABLE_SANDBOX before requiring electron — needed for snap` to `// Set ELECTRON_DISABLE_SANDBOX before requiring electron`
- [ ] Remove line 2 comment `// where no shell wrapper can pass --no-sandbox as CLI arg to child processes` (misleading — the wrapper does exist in afterPack now)

## Step 7 — Remove Flatpak toolchain from CI workflows

### `.github/workflows/ci.yml`

- [ ] Delete lines 44-50 (entire "Install Flatpak toolchain" step)

### `.github/workflows/release.yml`

- [ ] Delete lines 23-29 (entire "Install Flatpak toolchain" step)

## Step 8 — Remove `*.snap` from `.gitignore`

- [ ] Delete `*.snap` line (line 6)
- [ ] Add `*.flatpak` and `*.snap` are not needed since `dist/` already covers them. Actually `dist/` is already in gitignore, so just remove the `*.snap` line.

## Step 9 — Delete built artifacts

- [ ] Delete `dist/whatslnx_0.1.0_amd64.snap` (97.9M)
- [ ] Delete `dist/WhatsLNX-0.1.0-x86_64.flatpak` (82.2M)

These are in `dist/` which is gitignored, so won't affect repo. Local cleanup only.

## Step 10 — Update `README.md`

### Installation section

- [ ] Remove "### Snap (Ubuntu)" section (lines 40-46)
- [ ] Remove "### Flatpak" section (lines 59-70)

### Prerequisites

- [ ] Remove "For Flatpak builds, also install:" and its code block (lines 79-86)

### Build command

- [ ] Change `npm run build    # Build all packages (AppImage + Snap + DEB + Flatpak)` → `npm run build    # Build all packages (AppImage + DEB)`

### Individual targets

- [ ] Remove `npm run build:snap` (line 102)
- [ ] Remove `npm run build:flatpak` (line 104)

### Uninstallation section

- [ ] Remove "### Snap" section (lines 118-122)
- [ ] Remove "### Flatpak" section (lines 131-134)

### Competitive comparison table

- [ ] Row "Audio/Video calling": change `Broken in Snap` → `Broken` or `Partial` (line 184)
- [ ] Row "Package formats": change `AppImage, Snap, DEB, Flatpak` → `AppImage, DEB` (line 196)
- [ ] WhatsDesk column: change `AppImage, DEB, Snap` → `AppImage, DEB, Snap` (leave competitors as-is — they still offer those formats)
- [ ] Whatsie column: leave as-is
- [ ] WhatsApp for Linux column: leave as-is

## Step 11 — Update `docs/PRD.md`

PRD is a product requirements document — references to Snap/Flatpak are in requirements/specs. These should be updated to reflect current scope.

- [ ] Line 46: Change `DEB, Snap, AppImage` → `DEB, AppImage`
- [ ] Line 75: Update the Snap confinement pain point sentence to remove Snap-specific wording or keep as historical context ("why we chose not to ship Snap")
- [ ] Line 93: Remove `and pre-connecting Snap sandbox plugs`
- [ ] Line 123: Change `AppImage, Snap, DEB` → `AppImage, DEB`
- [ ] Lines 205-236: Remove or comment out FR-2.2 Snap plugs specification section
- [ ] Lines 419-455: Remove or comment out Section 8.2 Snap Package requirements
- [ ] Line 477: Remove Snap signing mention
- [ ] Line 529: Remove Snap from tamper-prevention strategies
- [ ] Line 534: Remove `or Snap's equivalent path` reference
- [ ] Lines 647: Keep Flatpak as Phase 4 future option (already marked future)
- [ ] Line 700: Update comparison table package formats
- [ ] Lines 745-769: Remove Snap interfaces/content plugs spec section
- [ ] Lines 784-785: Remove Electron Snapcraft external reference

## Step 12 — Update `docs/COMPLETENESS-REPORT.md`

- [ ] Line 50: Remove or mark Snap row as removed
- [ ] Line 67: Remove "Published to Snap Store" row
- [ ] Lines 86-92: Remove critical issue C2 (Snap confinement)
- [ ] Lines 104-108: Remove moderate issue M1 (Snap content plugs)
- [ ] Line 138: Update appId issue — remove Flatpak manifest reference
- [ ] Line 150-153: Remove/update L1 Flatpak bonus section
- [ ] Line 163: Remove Snap/Flatpak SUID sandbox reference
- [ ] Line 213: Remove Snap and Flatpak rows from status table
- [ ] Line 215: Remove Flatpak row
- [ ] Line 261: Remove "Resolve Snap confinement" action item

## Step 13 — Update `docs/initial-rnd.md`

- [ ] Line 4: Remove `Snap/Flatpak` from calling bugs mention or rephrase
- [ ] Line 93: Remove `Snap/Flatpak` from distribution config mention

## Step 14 — Remove `@malept/flatpak-bundler` from dependency tree

This is a transitive dependency via `electron-builder` — not directly in package.json. No action needed; `npm ci` will pull only what's needed. The entry in `package-lock.json` stays as part of electron-builder's tree. No manual removal required.

- [ ] Skip — no action needed

## Step 15 — Remove `dist/builder-effective-config.yaml`

This is a generated file in `dist/` (gitignored). Will be regenerated on next build. No action needed.

- [ ] Skip — auto-regenerated

---

## Execution Order

Steps 1-9 are independent code/config changes — can be done in any order.
Steps 10-13 are doc updates — do after code changes.
Steps 14-15 are no-ops.

Recommended sequence: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13**

## Verification

After all changes:
- [ ] `npm run build` should produce only AppImage + deb (no snap, no flatpak)
- [ ] `npm run build:appimage` works
- [ ] `npm run build:deb` works
- [ ] `npm run build:snap` and `npm run build:flatpak` should fail (scripts removed)
- [ ] `grep -ri "snap\|flatpak" src/ scripts/ electron-builder.yml package.json .github/` returns zero matches
- [ ] `grep -ri "snap\|flatpak" README.md docs/` returns only intentional mentions (e.g., "why not Snap" or Phase 4 future)
- [ ] CI workflow runs without Flatpak toolchain install step
- [ ] Release workflow publishes only AppImage + deb to GitHub Releases
