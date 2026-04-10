// Shared utility functions

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate hex color
 */
function isValidColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Safe color with fallback
 */
function safeColor(color, fallback = '#a8a8b3') {
  return isValidColor(color) ? color : fallback;
}

/**
 * Safe integer parsing
 */
function safeInt(val, defaultValue) {
  const n = parseInt(val);
  return isNaN(n) ? defaultValue : n;
}

/**
 * Generate random color from string
 */
function stringToColor(str) {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399',
    '#60a5fa', '#c084fc', '#f472b6', '#67e8f9'
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay(attempt, baseDelay = 2000, maxDelay = 30000) {
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}

/**
 * Create DOM element
 */
function createElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

/**
 * Clamp number between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    isValidColor,
    safeColor,
    safeInt,
    stringToColor,
    getReconnectDelay,
    createElement,
    clamp,
    debounce,
  };
} else {
  window.UmbraUtils = {
    escapeHtml,
    isValidColor,
    safeColor,
    safeInt,
    stringToColor,
    getReconnectDelay,
    createElement,
    clamp,
    debounce,
  };
}
