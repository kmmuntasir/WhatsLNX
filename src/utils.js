// Pure utility functions extracted for testability

const ALLOWED_PERMISSIONS = ['media', 'notifications', 'geolocation', 'display-capture'];

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

module.exports = {
  ALLOWED_PERMISSIONS,
  parseUnreadCount,
  clampPosition,
  buildDeepLinkUrl,
  isPermissionAllowed,
  buildBadgeLabel,
  generateFontCSS,
  isAllowedNavigation,
};
