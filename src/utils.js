// Pure utility functions extracted for testability

const ALLOWED_PERMISSIONS = ['media', 'notifications', 'geolocation', 'display-capture'];

// Chromium network error codes that mean "no connectivity" rather than a
// broken page — used to decide when to show the offline page.
const NETWORK_ERROR_CODES = new Set([
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NETWORK_CHANGED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_ABORTED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_CAPTIVE_PORTAL',
  'ERR_EMPTY_RESPONSE',
  'ERR_NETWORK_IO_SUSPENDED',
  'ERR_NETWORK_ACCESS_DENIED',
]);

/**
 * Extract unread message count from WhatsApp Web page title.
 * Title format: "(3) WhatsApp" or "WhatsApp"
 */
function parseUnreadCount(title) {
  if (!title || typeof title !== 'string') return 0;
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Clamp saved window position to visible screen bounds.
 * Returns original position if visible, or offset from primary display if not.
 */
function clampPosition(position, displays, primaryWorkArea) {
  if (position.x == null || position.y == null) return position;
  const visible = displays.some(d => {
    const { x, y, width, height } = d.workArea;
    return position.x >= x && position.x < x + width && position.y >= y && position.y < y + height;
  });
  if (visible) return position;
  return { x: primaryWorkArea.x + 50, y: primaryWorkArea.y + 50 };
}

/**
 * Parse a whatsapp:// deep link URL and return the corresponding WhatsApp Web URL.
 * Returns null if the URL is invalid or unsupported.
 */
function buildDeepLinkUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'send') {
      const phone = parsed.searchParams.get('phone') || '';
      const text = parsed.searchParams.get('text') || '';
      return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a permission should be granted.
 */
function isPermissionAllowed(permission) {
  return ALLOWED_PERMISSIONS.includes(permission);
}

/**
 * Build badge label string from unread count.
 * Returns "1"-"9" for counts 1-9, "9+" for counts > 9.
 */
function buildBadgeLabel(count) {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

/**
 * Generate CSS string from font configuration object.
 * Returns empty string if no fonts are configured.
 */
function generateFontCSS(fonts) {
  if (!fonts || (!fonts.serif && !fonts.sansSerif && !fonts.monospace)) return '';
  let css = '';
  if (fonts.sansSerif) css += `* { font-family: '${fonts.sansSerif}', sans-serif !important; }\n`;
  if (fonts.serif) css += `serif, .serif { font-family: '${fonts.serif}', serif !important; }\n`;
  if (fonts.monospace) css += `code, pre, .monospace, [data-font="monospace"] { font-family: '${fonts.monospace}', monospace !important; }\n`;
  return css;
}

/**
 * Validate that a navigation URL is within allowed WhatsApp domains.
 */
function isAllowedNavigation(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'web.whatsapp.com' || parsed.hostname === 'whatsapp.com');
  } catch {
    return false;
  }
}

/**
 * Check whether a `did-fail-load` error description is a connectivity error.
 */
function isNetworkError(errorDescription) {
  return typeof errorDescription === 'string' && NETWORK_ERROR_CODES.has(errorDescription);
}

/**
 * Escape a string for safe interpolation into HTML.
 */
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Extract the section of a Keep-a-Changelog style CHANGELOG for a version.
 * Returns the lines between `## [<version>]` and the next `## [` header
 * (trimmed), or an empty string when the version has no section.
 */
function extractChangelogSection(markdown, version) {
  if (typeof markdown !== 'string' || !version) return '';
  const lines = markdown.split('\n');
  const start = lines.findIndex(line => line.startsWith(`## [${version}]`));
  if (start === -1) return '';
  const end = lines.findIndex((line, i) => i > start && /^## \[/.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

module.exports = {
  ALLOWED_PERMISSIONS,
  NETWORK_ERROR_CODES,
  parseUnreadCount,
  clampPosition,
  buildDeepLinkUrl,
  isPermissionAllowed,
  buildBadgeLabel,
  generateFontCSS,
  isAllowedNavigation,
  isNetworkError,
  escapeHtml,
  extractChangelogSection,
};
