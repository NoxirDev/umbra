// UMBRA API v2 - Middleware module
const CONSTANTS = require('../shared/constants');
const logger = require('../shared/logger');

class ApiMiddleware {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.rateLimit = new Map();
    this.rateLimitCleanup = null;
    this.logger = logger;
  }

  /**
   * Initialize rate limiting cleanup
   */
  initRateLimitCleanup() {
    if (this.rateLimitCleanup) {
      clearInterval(this.rateLimitCleanup);
    }

    this.rateLimitCleanup = setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of this.rateLimit.entries()) {
        const filtered = timestamps.filter(t => t > now - 60000);
        if (filtered.length === 0) {
          this.rateLimit.delete(ip);
        } else {
          this.rateLimit.set(ip, filtered);
        }
      }
    }, 30000); // Every 30s
  }

  /**
   * Check rate limit for IP
   */
  checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = this.rateLimit.get(ip) || [];
    const recent = timestamps.filter(t => t > now - 60000);
    
    if (recent.length >= CONSTANTS.API_RATE_LIMIT) {
      return false;
    }
    
    recent.push(now);
    this.rateLimit.set(ip, recent);
    return true;
  }

  /**
   * Cleanup rate limiting
   */
  cleanup() {
    if (this.rateLimitCleanup) {
      clearInterval(this.rateLimitCleanup);
      this.rateLimitCleanup = null;
    }
    this.rateLimit.clear();
    
    // Stop log buffering
    this.logger.stopBuffering();
  }

  /**
   * Check authentication
   */
  checkAuth(req, apiKey) {
    const clientIp = req.socket.remoteAddress;
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

    // Skip auth for localhost
    if (isLocalhost) {
      return { authorized: true, ip: clientIp, isLocalhost: true };
    }

    const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || '';
    
    if (key !== apiKey) {
      return { authorized: false, ip: clientIp, isLocalhost: false, error: 'Invalid API key' };
    }

    return { authorized: true, ip: clientIp, isLocalhost: false };
  }

  /**
   * Set CORS headers
   */
  setCorsHeaders(res, req) {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://127.0.0.1:4587',
      'http://localhost:4587',
      'http://127.0.0.1:3000',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin) || origin === 'null') {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'null');
    }
    
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
  }

  /**
   * Handle OPTIONS request
   */
  handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }
    return false;
  }

  /**
   * Validate request body size
   */
  validateBodySize(req) {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    return contentLength <= CONSTANTS.MAX_BODY_SIZE;
  }

  /**
   * Parse request body
   */
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        
        // Check size limit
        if (body.length > CONSTANTS.MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Request body too large'));
        }
      });
      
      req.on('end', () => {
        try {
          if (!body) {
            resolve({});
            return;
          }
          
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', reject);
    });
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message, details = null) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    const error = {
      error: true,
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    };
    
    if (details) {
      error.details = details;
    }
    
    res.end(JSON.stringify(error));
  }

  /**
   * Send success response
   */
  sendSuccess(res, data = {}, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    res.end(JSON.stringify(response));
  }

  /**
   * Log request
   */
  logRequest(req, authResult, statusCode) {
    const method = req.method;
    const url = req.url;
    const ip = authResult.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    this.logger.logRequest(method, url, ip, statusCode, userAgent);
  }

  /**
   * Validate donation data
   */
  validateDonation(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }
    
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) < 0) {
      errors.push('Amount must be a valid positive number');
    }
    
    if (data.message && typeof data.message !== 'string') {
      errors.push('Message must be a string');
    }
    
    if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
      errors.push('Currency must be a valid 3-letter code (e.g., USD, EUR)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate message data
   */
  validateMessage(data) {
    const errors = [];
    
    if (!data.author || typeof data.author !== 'string' || data.author.trim().length === 0) {
      errors.push('Author is required and must be a non-empty string');
    }
    
    if (!data.text || typeof data.text !== 'string' || data.text.trim().length === 0) {
      errors.push('Text is required and must be a non-empty string');
    }
    
    if (data.text && data.text.length > 500) {
      errors.push('Text must be less than 500 characters');
    }
    
    if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
      errors.push('Color must be a valid hex color (e.g., #ffffff)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate webhook data
   */
  validateWebhook(data) {
    const errors = [];
    
    if (!data.url || typeof data.url !== 'string' || !this.isValidUrl(data.url)) {
      errors.push('URL is required and must be a valid URL');
    }
    
    if (!data.events || !Array.isArray(data.events) || data.events.length === 0) {
      errors.push('Events must be a non-empty array');
    }
    
    if (data.secret && typeof data.secret !== 'string') {
      errors.push('Secret must be a string');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if URL is valid
   */
  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

module.exports = ApiMiddleware;