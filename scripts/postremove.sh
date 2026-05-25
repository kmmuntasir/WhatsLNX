#!/bin/bash
# Unregister whatsapp:// URI scheme handler and remove CLI symlink
set -e
rm -f /usr/bin/whatslnx
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
