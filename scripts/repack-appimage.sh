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

echo ">> Rebuilding AppImage with static runtime…"
VERSION="$APP_VERSION" "$WORK/appimagetool" --comp zstd \
  --mksquashfs-opt -Xcompression-level --mksquashfs-opt 20 \
  -n "$EXTRACT_DIR" "$APPIMAGE"

echo ">> Verifying repacked AppImage…"
"$APPIMAGE" --appimage-extract-and-run --version

echo ">> Regenerating dist/latest-linux.yml…"
node scripts/generate-update-info.js

echo ">> Done: $APPIMAGE (static AppImage runtime, no libfuse2 needed)"
