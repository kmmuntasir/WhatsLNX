#!/bin/bash
# Register whatsapp:// URI scheme handler
set -e
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
