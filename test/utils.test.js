const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseUnreadCount,
  clampPosition,
  buildDeepLinkUrl,
  isPermissionAllowed,
  buildBadgeLabel,
  generateFontCSS,
  isAllowedNavigation,
  ALLOWED_PERMISSIONS,
} = require('../src/utils');

// ---------------------------------------------------------------------------
// parseUnreadCount
// ---------------------------------------------------------------------------
describe('parseUnreadCount', () => {
  it('extracts count from "(3) WhatsApp"', () => {
    assert.equal(parseUnreadCount('(3) WhatsApp'), 3);
  });

  it('extracts count from "(42) WhatsApp"', () => {
    assert.equal(parseUnreadCount('(42) WhatsApp'), 42);
  });

  it('extracts count from "(999) WhatsApp"', () => {
    assert.equal(parseUnreadCount('(999) WhatsApp'), 999);
  });

  it('returns 0 for plain "WhatsApp"', () => {
    assert.equal(parseUnreadCount('WhatsApp'), 0);
  });

  it('returns 0 for empty string', () => {
    assert.equal(parseUnreadCount(''), 0);
  });

  it('returns 0 for null', () => {
    assert.equal(parseUnreadCount(null), 0);
  });

  it('returns 0 for undefined', () => {
    assert.equal(parseUnreadCount(undefined), 0);
  });

  it('returns 0 for non-string input', () => {
    assert.equal(parseUnreadCount(123), 0);
  });

  it('ignores parenthesized text in the middle', () => {
    assert.equal(parseUnreadCount('WhatsApp (3)'), 0);
  });

  it('handles "(0) WhatsApp" as 0', () => {
    assert.equal(parseUnreadCount('(0) WhatsApp'), 0);
  });
});

// ---------------------------------------------------------------------------
// clampPosition
// ---------------------------------------------------------------------------
describe('clampPosition', () => {
  const singleDisplay = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const primaryWorkArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it('returns original position if within display bounds', () => {
    const pos = { x: 100, y: 200 };
    assert.deepEqual(clampPosition(pos, singleDisplay, primaryWorkArea), pos);
  });

  it('clamps to primary display if position is off-screen', () => {
    const pos = { x: 3000, y: 200 };
    assert.deepEqual(clampPosition(pos, singleDisplay, primaryWorkArea), { x: 50, y: 50 });
  });

  it('clamps negative coordinates off-screen', () => {
    const pos = { x: -500, y: -500 };
    assert.deepEqual(clampPosition(pos, singleDisplay, primaryWorkArea), { x: 50, y: 50 });
  });

  it('passes through when x or y is undefined', () => {
    const pos = { x: undefined, y: undefined };
    assert.deepEqual(clampPosition(pos, singleDisplay, primaryWorkArea), pos);
  });

  it('passes through when x is null', () => {
    const pos = { x: null, y: 100 };
    assert.deepEqual(clampPosition(pos, singleDisplay, primaryWorkArea), pos);
  });

  it('works with multi-monitor setup', () => {
    const displays = [
      { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { workArea: { x: 1920, y: 0, width: 2560, height: 1440 } },
    ];
    const pos = { x: 2000, y: 500 };
    assert.deepEqual(clampPosition(pos, displays, primaryWorkArea), pos);
  });

  it('clamps when position falls between monitors', () => {
    const displays = [
      { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { workArea: { x: 2000, y: 0, width: 1920, height: 1080 } },
    ];
    // x=1950 is in the gap between 1920 and 2000
    const pos = { x: 1950, y: 500 };
    assert.deepEqual(clampPosition(pos, displays, primaryWorkArea), { x: 50, y: 50 });
  });

  it('respects non-zero primary workArea origin', () => {
    const displays = [{ workArea: { x: 100, y: 100, width: 1920, height: 1080 } }];
    const primary = { x: 100, y: 100, width: 1920, height: 1080 };
    const pos = { x: 5000, y: 5000 };
    assert.deepEqual(clampPosition(pos, displays, primary), { x: 150, y: 150 });
  });
});

// ---------------------------------------------------------------------------
// buildDeepLinkUrl
// ---------------------------------------------------------------------------
describe('buildDeepLinkUrl', () => {
  it('builds URL with phone and text', () => {
    const result = buildDeepLinkUrl('whatsapp://send?phone=1234567890&text=Hello');
    assert.equal(result, 'https://web.whatsapp.com/send?phone=1234567890&text=Hello');
  });

  it('builds URL with phone only', () => {
    const result = buildDeepLinkUrl('whatsapp://send?phone=1234567890');
    assert.equal(result, 'https://web.whatsapp.com/send?phone=1234567890&text=');
  });

  it('builds URL with text only', () => {
    const result = buildDeepLinkUrl('whatsapp://send?text=Hello');
    assert.equal(result, 'https://web.whatsapp.com/send?phone=&text=Hello');
  });

  it('encodes special characters in text', () => {
    const result = buildDeepLinkUrl('whatsapp://send?text=Hello World&phone=123');
    assert.ok(result.includes('text=Hello%20World'));
  });

  it('returns null for non-send hostname', () => {
    const result = buildDeepLinkUrl('whatsapp://call?phone=123');
    assert.equal(result, null);
  });

  it('returns null for invalid URL', () => {
    const result = buildDeepLinkUrl('not a url');
    assert.equal(result, null);
  });

  it('returns null for empty string', () => {
    const result = buildDeepLinkUrl('');
    assert.equal(result, null);
  });

  it('builds URL with no params', () => {
    const result = buildDeepLinkUrl('whatsapp://send');
    assert.equal(result, 'https://web.whatsapp.com/send?phone=&text=');
  });
});

// ---------------------------------------------------------------------------
// isPermissionAllowed
// ---------------------------------------------------------------------------
describe('isPermissionAllowed', () => {
  it('allows media', () => {
    assert.equal(isPermissionAllowed('media'), true);
  });

  it('allows notifications', () => {
    assert.equal(isPermissionAllowed('notifications'), true);
  });

  it('allows geolocation', () => {
    assert.equal(isPermissionAllowed('geolocation'), true);
  });

  it('allows display-capture', () => {
    assert.equal(isPermissionAllowed('display-capture'), true);
  });

  it('denies persistent-storage', () => {
    assert.equal(isPermissionAllowed('persistent-storage'), false);
  });

  it('denies midi', () => {
    assert.equal(isPermissionAllowed('midi'), false);
  });

  it('denies empty string', () => {
    assert.equal(isPermissionAllowed(''), false);
  });

  it('denies unknown permissions', () => {
    assert.equal(isPermissionAllowed('bluetooth'), false);
  });

  it('has exactly 4 allowed permissions', () => {
    assert.equal(ALLOWED_PERMISSIONS.length, 4);
  });
});

// ---------------------------------------------------------------------------
// buildBadgeLabel
// ---------------------------------------------------------------------------
describe('buildBadgeLabel', () => {
  it('returns empty for 0', () => {
    assert.equal(buildBadgeLabel(0), '');
  });

  it('returns empty for negative', () => {
    assert.equal(buildBadgeLabel(-1), '');
  });

  it('returns "1" for 1', () => {
    assert.equal(buildBadgeLabel(1), '1');
  });

  it('returns "9" for 9', () => {
    assert.equal(buildBadgeLabel(9), '9');
  });

  it('returns "9+" for 10', () => {
    assert.equal(buildBadgeLabel(10), '9+');
  });

  it('returns "9+" for 999', () => {
    assert.equal(buildBadgeLabel(999), '9+');
  });
});

// ---------------------------------------------------------------------------
// generateFontCSS
// ---------------------------------------------------------------------------
describe('generateFontCSS', () => {
  it('returns empty for null', () => {
    assert.equal(generateFontCSS(null), '');
  });

  it('returns empty for empty object', () => {
    assert.equal(generateFontCSS({}), '');
  });

  it('returns empty when all fonts are empty strings', () => {
    assert.equal(generateFontCSS({ serif: '', sansSerif: '', monospace: '' }), '');
  });

  it('generates CSS for sansSerif only', () => {
    const css = generateFontCSS({ sansSerif: 'Noto Sans' });
    assert.ok(css.includes("font-family: 'Noto Sans', sans-serif !important"));
    assert.ok(!css.includes('serif,'));
    assert.ok(!css.includes('code,'));
  });

  it('generates CSS for serif only', () => {
    const css = generateFontCSS({ serif: 'Noto Serif' });
    assert.ok(css.includes("font-family: 'Noto Serif', serif !important"));
  });

  it('generates CSS for monospace only', () => {
    const css = generateFontCSS({ monospace: 'Fira Code' });
    assert.ok(css.includes("font-family: 'Fira Code', monospace !important"));
    assert.ok(css.includes('code, pre, .monospace'));
  });

  it('generates CSS for all three fonts', () => {
    const css = generateFontCSS({
      serif: 'Times',
      sansSerif: 'Arial',
      monospace: 'Courier',
    });
    assert.ok(css.includes("'Arial'"));
    assert.ok(css.includes("'Times'"));
    assert.ok(css.includes("'Courier'"));
  });
});

// ---------------------------------------------------------------------------
// isAllowedNavigation
// ---------------------------------------------------------------------------
describe('isAllowedNavigation', () => {
  it('allows web.whatsapp.com', () => {
    assert.equal(isAllowedNavigation('https://web.whatsapp.com'), true);
  });

  it('allows web.whatsapp.com subpath', () => {
    assert.equal(isAllowedNavigation('https://web.whatsapp.com/send?phone=123'), true);
  });

  it('allows whatsapp.com', () => {
    assert.equal(isAllowedNavigation('https://whatsapp.com'), true);
  });

  it('blocks google.com', () => {
    assert.equal(isAllowedNavigation('https://google.com'), false);
  });

  it('blocks http whatsapp', () => {
    assert.equal(isAllowedNavigation('http://web.whatsapp.com'), false);
  });

  it('blocks similar-looking domains', () => {
    assert.equal(isAllowedNavigation('https://web.whatsapp.com.evil.com'), false);
  });

  it('blocks javascript: URLs', () => {
    assert.equal(isAllowedNavigation('javascript:alert(1)'), false);
  });
});
