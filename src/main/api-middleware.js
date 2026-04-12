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
  setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
}

module.exports = ApiMiddleware;