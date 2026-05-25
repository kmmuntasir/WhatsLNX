# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Instead, email [kmmuntasir@gmail.com](mailto:kmmuntasir@gmail.com) with the subject line `WhatsLNX Security: <brief description>`.

Include:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

You should receive a response within 48 hours. If the issue is confirmed, a fix will be prioritized and a GitHub Security Advisory may be published.

## Security Model

WhatsLNX is an Electron wrapper around WhatsApp Web. Key security properties:

- **Context isolation** enabled on the main window (`contextIsolation: true`)
- **Node integration** disabled on the main window (`nodeIntegration: false`)
- **Chromium sandbox** enabled on the renderer process
- **HTTPS only** — hardcoded to `https://web.whatsapp.com`
- **Navigation guards** — blocks navigation away from `whatsapp.com` domains
- **Minimal IPC surface** — only exposes `onTitleChange`, `getUnreadCount`, and `send` via `contextBridge`
- **No credential storage** — WhatsApp session cookies are managed by Chromium's default session storage

## Known Considerations

- The `--no-sandbox` Chromium flag is used on Linux (renderer sandbox via `sandbox: true` in webPreferences remains active)
- WhatsApp Web is a third-party service — WhatsLNX has no control over its security posture
