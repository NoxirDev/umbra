const {
  escapeHtml, isValidColor, safeColor, safeInt,
  stringToColor, getReconnectDelay, clamp, isSafeUrl
} = require('../src/shared/utils');

describe('escapeHtml', () => {
  test('escapes special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  test('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  test('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  test('handles non-string input', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('isValidColor', () => {
  test('accepts valid hex colors', () => {
    expect(isValidColor('#ff0000')).toBe(true);
    expect(isValidColor('#ABC123')).toBe(true);
    expect(isValidColor('#000000')).toBe(true);
  });

  test('rejects invalid colors', () => {
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#fff')).toBe(false);
    expect(isValidColor('#12345')).toBe(false);
    expect(isValidColor('')).toBe(false);
    expect(isValidColor(null)).toBe(false);
  });
});

describe('safeColor', () => {
  test('returns valid color unchanged', () => {
    expect(safeColor('#ff0000')).toBe('#ff0000');
  });

  test('returns fallback for invalid color', () => {
    expect(safeColor('invalid')).toBe('#a8a8b3');
    expect(safeColor('#fff')).toBe('#a8a8b3');
  });

  test('accepts custom fallback', () => {
    expect(safeColor('invalid', '#ffffff')).toBe('#ffffff');
  });
});

describe('safeInt', () => {
  test('parses valid integers', () => {
    expect(safeInt('42', 0)).toBe(42);
    expect(safeInt('-5', 0)).toBe(-5);
    expect(safeInt(100, 0)).toBe(100);
  });

  test('returns default for NaN', () => {
    expect(safeInt('abc', 10)).toBe(10);
    expect(safeInt(undefined, 10)).toBe(10);
    expect(safeInt(null, 10)).toBe(10);
  });
});

describe('stringToColor', () => {
  test('returns a valid hex color', () => {
    const color = stringToColor('testuser');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('deterministic output for same input', () => {
    expect(stringToColor('alice')).toBe(stringToColor('alice'));
  });

  test('different inputs give different colors (usually)', () => {
    expect(stringToColor('alice')).not.toBe(stringToColor('bob'));
  });

  test('handles empty/null input', () => {
    const color = stringToColor('');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    const color2 = stringToColor(null);
    expect(color2).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('getReconnectDelay', () => {
  test('exponential backoff', () => {
    expect(getReconnectDelay(0)).toBe(2000);
    expect(getReconnectDelay(1)).toBe(4000);
    expect(getReconnectDelay(2)).toBe(8000);
    expect(getReconnectDelay(3)).toBe(16000);
  });

  test('respects max delay', () => {
    expect(getReconnectDelay(10)).toBe(30000);
    expect(getReconnectDelay(100)).toBe(30000);
  });

  test('custom base and max', () => {
    expect(getReconnectDelay(0, 1000, 10000)).toBe(1000);
    expect(getReconnectDelay(5, 1000, 10000)).toBe(10000);
  });
});

describe('clamp', () => {
  test('clamps value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('isSafeUrl', () => {
  test('accepts valid emote URLs', () => {
    expect(isSafeUrl('https://static-cdn.jtvnw.net/emoticons/v1/123/2.0')).toBe(true);
    expect(isSafeUrl('https://cdn.betterttv.net/emote/abc/2x')).toBe(true);
    expect(isSafeUrl('https://cdn.frankerfacez.com/emote/123')).toBe(true);
    expect(isSafeUrl('https://7tv.io/emote/xyz')).toBe(true);
    expect(isSafeUrl('https://badges.twitch.tv/v1/badges/1')).toBe(true);
  });

  test('rejects non-https URLs', () => {
    expect(isSafeUrl('http://evil.com/emote')).toBe(false);
    expect(isSafeUrl('ftp://cdn.betterttv.net/emote')).toBe(false);
  });

  test('rejects unknown domains', () => {
    expect(isSafeUrl('https://evil.com/emote')).toBe(false);
    expect(isSafeUrl('https://cdn.evil.com/emote')).toBe(false);
  });

  test('rejects invalid URLs', () => {
    expect(isSafeUrl('not-a-url')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});
