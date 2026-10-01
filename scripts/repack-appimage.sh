#!/usr/bin/env bash
#
# Repack the electron-builder AppImage with the modern statically-linked
# AppImage runtime (https://github.com/AppImage/type2-runtime).
#
# electron-builder still embeds the old runtime, which is dynamically linked
# against the system C library and libfuse2 — the latter is EOL and no longer
# shipped by modern distributions (AppImage catalog PR feedback, FreeTube
# electron-builder#8686). appimagetool embeds the static runtime by default.
#
# Trade-off: the embedded blockmap (delta updates) is dropped; electron-updater
# detects this and falls back to full downloads automatically.
# scripts/generate-update-info.js rewrites latest-linux.yml afterwards so the
# sha512/size match the repacked file.
#
# Usage: ./scripts/repack-appimage.sh   (after `npm run build:appimage`)
set -euo pipefail

cd "$(dirname "$0")/.."

DIST=dist
APP_VERSION="$(jq -r .version package.json)"
APPIMAGE="$(cd "$DIST" && pwd)/WhatsLNX-${APP_VERSION}.AppImage"
if [ ! -f "$APPIMAGE" ]; then
  echo "error: WhatsLNX-${APP_VERSION}.AppImage not found in $DIST — run 'npm run build:appimage' first" >&2
  exit 1
fi
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
EXTRACT_DIR="$WORK/squashfs-root"

echo ">> Downloading appimagetool (static runtime)…"
curl -fL --retry 3 -o "$WORK/appimagetool" \
  "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
chmod +x "$WORK/appimagetool"
# Run appimagetool without requiring FUSE (e.g. on CI runners)
export APPIMAGE_EXTRACT_AND_RUN=1

echo ">> Extracting $APPIMAGE…"
if ! (cd "$WORK" && "$APPIMAGE" --appimage-extract >/dev/null 2>&1) || [ ! -d "$EXTRACT_DIR" ]; then
  # Fallback for hosts where the old runtime cannot even load (no libfuse2):
  # carve the squashfs out of the AppImage and unpack it with unsquashfs.
  echo ">> --appimage-extract failed, falling back to unsquashfs…"
  OFFSET="$("$APPIMAGE" --appimage-offset 2>/dev/null || true)"
  if [ -z "$OFFSET" ]; then
    # Last resort: scan for the squashfs magic. Note the runtime binary itself
    # contains the "hsqs" literal, so try every candidate offset until one
    # yields a valid superblock.
    for CANDIDATE in $(grep -aob 'hsqs' "$APPIMAGE" | cut -d: -f1); do
      if unsquashfs -no-progress -offset "$CANDIDATE" -dest "$EXTRACT_DIR" "$APPIMAGE" >/dev/null 2>&1; then
        OFFSET="$CANDIDATE"
        break
      fi
      rm -rf "$EXTRACT_DIR"
    done
  fi
  if [ -z "$OFFSET" ]; then
    echo "error: could not locate squashfs payload in $APPIMAGE" >&2
    exit 1
  fi
  if [ ! -d "$EXTRACT_DIR" ]; then
    unsquashfs -no-progress -offset "$OFFSET" -dest "$EXTRACT_DIR" "$APPIMAGE" >/dev/null
  fi
fi

echo ">> Normalizing permissions (extraction applies the caller's umask, which can produce 0700 dirs or group-writable files; AppImages must be world-readable/traversable — e.g. the AppImage catalog test runs them from a root-owned extraction)"
chmod -R go-w "$EXTRACT_DIR"
chmod -R a+rX "$EXTRACT_DIR"
find "$EXTRACT_DIR" -type d -exec chmod 755 {} +
chmod 755 "$EXTRACT_DIR/AppRun"

echo ">> Rebuilding AppImage with static runtime…"
# Embed AppImageUpdate information and generate the matching .zsync file.
# zsyncmake writes its output to the *current directory*, so run appimagetool
# from dist/. The pattern must match the .zsync asset name uploaded to
# GitHub Releases.
UPDATE_INFO="gh-releases-zsync|kmmuntasir|WhatsLNX|latest|WhatsLNX-*.AppImage.zsync"
(cd "$DIST" && VERSION="$APP_VERSION" "$WORK/appimagetool" --comp zstd \
  --mksquashfs-opt -Xcompression-level --mksquashfs-opt 20 \
  -u "$UPDATE_INFO" \
  -n "$EXTRACT_DIR" "$APPIMAGE")

if [ ! -f "$APPIMAGE.zsync" ]; then
  echo "error: appimagetool did not generate $APPIMAGE.zsync" >&2
  exit 1
fi

echo ">> Verifying repacked AppImage…"
"$APPIMAGE" --appimage-extract-and-run --version

echo ">> Regenerating dist/latest-linux.yml…"
node scripts/generate-update-info.js

echo ">> Done: $APPIMAGE (static AppImage runtime, no libfuse2 needed)"
