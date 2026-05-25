#!/bin/bash
# Register whatsapp:// URI scheme handler and CLI symlink
set -e
cat > /usr/bin/whatslnx << 'WRAPPER'
#!/bin/sh
exec /opt/WhatsLNX/whatslnx "$@"
WRAPPER
chmod 755 /usr/bin/whatslnx
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
