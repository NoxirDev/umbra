// UMBRA API v2 - Router module
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../shared/logger');

class ApiRouter {
  constructor(middleware, websocket, settingsManager, windowManager, statisticsManager, notificationManager) {
    this.middleware = middleware;
    this.websocket = websocket;
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.statisticsManager = statisticsManager;
    this.notificationManager = notificationManager;
    this.logger = logger;
    
    // Event history
    this.donationHistory = [];
    this.messageHistory = [];
    this.maxHistorySize = 500;
    
    // OBS pages cache
    this.obsPageCache = new Map();
    this.cacheOBSPages();
    
    // Webhooks
    this.webhooks = [];
  }

  /**
   * Pre-cache OBS HTML pages for faster serving
   */
  cacheOBSPages() {
    const pages = ['overlay', 'chat', 'donations', 'goal'];
    pages.forEach(page => {
      const filePath = path.join(__dirname, '..', 'renderer', 'obs', `${page}.html`);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          this.obsPageCache.set(page, content);
        }
      } catch (err) {
        this.logger.error(`Failed to cache OBS page ${page}`, { error: err.message });
      }
    });
  }

  /**
   * Main request router
   */
  async routeRequest(req, res, apiKey) {
    const url = req.url;
    const method = req.method;
    
    // Handle OBS pages
    if (url.startsWith('/obs/')) {
      this.handleOBSPage(req, res);
      return;
    }

    // Handle dashboard
    if (url === '/' || url === '/dashboard') {
      this.handleDashboard(req, res);
      return;
    }

    // Handle API v2 routes
    if (url.startsWith('/v2/')) {
      await this.handleApiV2(req, res, apiKey);
      return;
    }

    // Handle 404
    this.middleware.sendError(res, 404, 'Not found');
  }

  /**
   * Handle OBS page requests
   */
  handleOBSPage(req, res) {
    const page = req.url.split('/')[2]?.split('?')[0] || 'overlay';
    
    if (!this.obsPageCache.has(page)) {
      this.middleware.sendError(res, 404, `OBS page '${page}' not found`);
      return;
    }

    const html = this.obsPageCache.get(page);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Handle dashboard request
   */
  handleDashboard(req, res) {
    const dashboardPath = path.join(__dirname, '..', 'renderer', 'web', 'dashboard.html');
    
    try {
      if (fs.existsSync(dashboardPath)) {
        const html = fs.readFileSync(dashboardPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else {
        this.middleware.sendSuccess(res, {
          message: 'UMBRA API v2',
          version: '2.1.1',
          endpoints: ['/v2/*', '/obs/*', '/dashboard'],
          documentation: 'See docs/API.md'
        });
      }
    } catch (err) {
      this.middleware.sendError(res, 500, 'Failed to load dashboard', err.message);
    }
  }

  /**
   * Handle API v2 routes
   */
  async handleApiV2(req, res, apiKey) {
    const url = req.url;
    const method = req.method;
    
    try {
      // Check rate limit
      const authResult = this.middleware.checkAuth(req, apiKey);
      if (!authResult.authorized) {
        this.middleware.sendError(res, 401, authResult.error || 'Unauthorized');
        return;
      }

      if (!this.middleware.checkRateLimit(authResult.ip)) {
        this.middleware.sendError(res, 429, 'Rate limit exceeded');
        return;
      }

      // Parse request body for POST/PUT/PATCH
      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        if (!this.middleware.validateBodySize(req)) {
          this.middleware.sendError(res, 413, 'Request body too large');
          return;
        }
        
        try {
          body = await this.middleware.parseBody(req);
        } catch (err) {
          this.middleware.sendError(res, 400, err.message);
          return;
        }
      }

      // Route to appropriate handler
      let result;
      if (url === '/v2/health') {
        result = this.handleHealth(req, res, body);
      } else if (url === '/v2/stats') {
        result = this.handleStats(req, res, body);
      } else if (url === '/v2/donations' && method === 'GET') {
        result = this.handleGetDonations(req, res, body);
      } else if (url === '/v2/donations' && method === 'POST') {
        result = this.handlePostDonation(req, res, body);
      } else if (url === '/v2/messages' && method === 'GET') {
        result = this.handleGetMessages(req, res, body);
      } else if (url === '/v2/messages' && method === 'POST') {
        result = this.handlePostMessage(req, res, body);
      } else if (url === '/v2/goal' && method === 'GET') {
        result = this.handleGetGoal(req, res, body);
      } else if (url === '/v2/goal' && method === 'POST') {
        result = this.handlePostGoal(req, res, body);
      } else if (url === '/v2/obs/config') {
        result = this.handleOBSConfig(req, res, body);
      } else if (url === '/v2/settings') {
        result = this.handleSettings(req, res, body, method);
      } else if (url === '/v2/webhooks') {
        result = this.handleWebhooks(req, res, body, method);
      } else {
        this.middleware.sendError(res, 404, 'Endpoint not found');
        return;
      }

      // Log successful request
      this.middleware.logRequest(req, authResult, 200);
      
    } catch (err) {
      this.logger.error('API Router error', { error: err.message, stack: err.stack });
      this.middleware.sendError(res, 500, 'Internal server error', err.message);
    }
  }

  /**
   * Health check endpoint
   */
  handleHealth(req, res) {
    try {
      // Check system components
      const components = {
        websocket: this.websocket ? 'healthy' : 'unavailable',
        settings: this.settingsManager ? 'healthy' : 'unavailable',
        statistics: this.statisticsManager ? 'healthy' : 'unavailable',
        notifications: this.notificationManager ? 'healthy' : 'unavailable',
        middleware: this.middleware ? 'healthy' : 'unavailable'
      };
      
      // Determine overall status
      const allHealthy = Object.values(components).every(status => status === 'healthy');
      const overallStatus = allHealthy ? 'healthy' : 'degraded';
      
      const data = {
        status: overallStatus,
        version: '2.1.1',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          external: Math.round(process.memoryUsage().external / 1024 / 1024) // MB
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          node: process.version,
          pid: process.pid
        },
        api: {
          clients: this.websocket.getClientCount(),
          donations: this.donationHistory.length,
          messages: this.messageHistory.length,
          webhooks: this.webhooks.length
        },
        components,
        checks: {
          rateLimit: this.middleware.checkRateLimit('127.0.0.1') !== false,
          obsPages: this.obsPageCache.size > 0
        }
      };
      
      // Log health check
      this.logger.info('Health check', { status: overallStatus, clients: data.api.clients });
      
      this.middleware.sendSuccess(res, data);
    } catch (err) {
      this.logger.error('Health check failed', { error: err.message });
      this.middleware.sendError(res, 500, 'Health check failed', err.message);
    }
  }

  /**
   * Statistics endpoint
   */
  handleStats(req, res) {
    const stats = this.statisticsManager.getStats();
    this.middleware.sendSuccess(res, stats);
  }

  /**
   * Get donations
   */
  handleGetDonations(req, res) {
    const limit = parseInt(req.url.split('?limit=')[1]) || 50;
    const donations = this.donationHistory.slice(-limit).reverse();
    
    this.middleware.sendSuccess(res, {
      donations,
      total: this.donationHistory.length,
      limit
    });
  }

  /**
   * Post new donation
   */
  handlePostDonation(req, res, body) {
    // Validate donation
    if (!body.name || !body.amount) {
      this.middleware.sendError(res, 400, 'Missing required fields: name, amount');
      return;
    }

    const donation = {
      id: crypto.randomBytes(8).toString('hex'),
      name: String(body.name).slice(0, 50),
      amount: parseFloat(body.amount) || 0,
      message: String(body.message || '').slice(0, 500),
      currency: String(body.currency || 'USD').toUpperCase(),
      timestamp: new Date().toISOString(),
      source: body.source || 'api'
    };

    // Add to history
    this.donationHistory.push(donation);
    if (this.donationHistory.length > this.maxHistorySize) {
      this.donationHistory.shift();
    }

    // Record in statistics
    this.statisticsManager.recordDonation(donation);

    // Send notification
    this.notificationManager.sendDonationNotification(donation);

    // Broadcast via WebSocket
    this.websocket.broadcastDonation(donation);

    // Trigger webhooks
    this.triggerWebhooks('donation', donation);

    this.middleware.sendSuccess(res, donation, 201);
  }

  /**
   * Get messages
   */
  handleGetMessages(req, res) {
    const limit = parseInt(req.url.split('?limit=')[1]) || 100;
    const messages = this.messageHistory.slice(-limit).reverse();
    
    this.middleware.sendSuccess(res, {
      messages,
      total: this.messageHistory.length,
      limit
    });
  }

  /**
   * Post new message
   */
  handlePostMessage(req, res, body) {
    if (!body.author || !body.text) {
      this.middleware.sendError(res, 400, 'Missing required fields: author, text');
      return;
    }

    const message = {
      id: crypto.randomBytes(8).toString('hex'),
      author: String(body.author).slice(0, 50),
      text: String(body.text).slice(0, 500),
      platform: body.platform || 'api',
      color: body.color || '#ffffff',
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Broadcast via WebSocket
    this.websocket.broadcastMessage(message);

    this.middleware.sendSuccess(res, message, 201);
  }

  /**
   * Get goal
   */
  handleGetGoal(req, res) {
    const settings = this.settingsManager.get();
    const goal = settings.goal || {
      enabled: false,
      target: 0,
      current: 0,
      title: '',
      description: ''
    };
    
    this.middleware.sendSuccess(res, goal);
  }

  /**
   * Update goal
   */
  handlePostGoal(req, res, body) {
    const settings = this.settingsManager.get();
    const currentGoal = settings.goal || { enabled: false, target: 0, current: 0 };
    
    const updatedGoal = {
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : currentGoal.enabled,
      target: body.target !== undefined ? parseFloat(body.target) : currentGoal.target,
      current: body.current !== undefined ? parseFloat(body.current) : currentGoal.current,
      title: String(body.title || currentGoal.title || '').slice(0, 100),
      description: String(body.description || currentGoal.description || '').slice(0, 500)
    };

    // Update settings
    this.settingsManager.update({ goal: updatedGoal });

    // Broadcast via WebSocket
    this.websocket.broadcastGoalUpdate(updatedGoal);

    this.middleware.sendSuccess(res, updatedGoal);
  }

  /**
   * Get OBS configuration
   */
  handleOBSConfig(req, res) {
    const settings = this.settingsManager.get();
    const apiKey = settings.api?.key || '';
    const port = settings.api?.port || 4587;
    
    const config = {
      overlay: `http://127.0.0.1:${port}/obs/overlay${apiKey ? `?key=${apiKey}` : ''}`,
      chat: `http://127.0.0.1:${port}/obs/chat${apiKey ? `?key=${apiKey}` : ''}`,
      donations: `http://127.0.0.1:${port}/obs/donations${apiKey ? `?key=${apiKey}` : ''}`,
      goal: `http://127.0.0.1:${port}/obs/goal${apiKey ? `?key=${apiKey}` : ''}`,
      port,
      hasKey: !!apiKey
    };
    
    this.middleware.sendSuccess(res, config);
  }

  /**
   * Handle settings endpoints
   */
  handleSettings(req, res, body, method) {
    if (method === 'GET') {
      const settings = this.settingsManager.get();
      // Remove sensitive data
      const { api, ...safeSettings } = settings;
      this.middleware.sendSuccess(res, safeSettings);
    } else if (method === 'PATCH') {
      // Update settings
      const updated = this.settingsManager.update(body);
      if (updated) {
        // Broadcast settings update
        this.websocket.broadcastSettingsUpdate(body);
        this.middleware.sendSuccess(res, { updated: true });
      } else {
        this.middleware.sendError(res, 500, 'Failed to update settings');
      }
    } else {
      this.middleware.sendError(res, 405, 'Method not allowed');
    }
  }

  /**
   * Handle webhooks
   */
  handleWebhooks(req, res, body, method) {
    if (method === 'GET') {
      this.middleware.sendSuccess(res, { webhooks: this.webhooks });
    } else if (method === 'POST') {
      // Add webhook
      if (!body.url || !body.events) {
        this.middleware.sendError(res, 400, 'Missing required fields: url, events');
        return;
      }
      
      const webhook = {
        id: crypto.randomBytes(8).toString('hex'),
        url: body.url,
        events: Array.isArray(body.events) ? body.events : [body.events],
        secret: body.secret || '',
        createdAt: new Date().toISOString()
      };
      
      this.webhooks.push(webhook);
      this.middleware.sendSuccess(res, webhook, 201);
    } else if (method === 'DELETE') {
      // Remove webhook
      const id = body.id;
      if (!id) {
        this.middleware.sendError(res, 400, 'Missing webhook ID');
        return;
      }
      
      const index = this.webhooks.findIndex(w => w.id === id);
      if (index === -1) {
        this.middleware.sendError(res, 404, 'Webhook not found');
        return;
      }
      
      this.webhooks.splice(index, 1);
      this.middleware.sendSuccess(res, { deleted: true });
    } else {
      this.middleware.sendError(res, 405, 'Method not allowed');
    }
  }

  /**
   * Trigger webhooks for event
   */
  async triggerWebhooks(eventType, data) {
    const relevantWebhooks = this.webhooks.filter(w => 
      w.events.includes('*') || w.events.includes(eventType)
    );

    if (relevantWebhooks.length === 0) return;

    // Fire and forget
    relevantWebhooks.forEach(webhook => {
      this.callWebhook(webhook, eventType, data).catch(err => {
        this.logger.error(`Webhook ${webhook.id} failed`, { error: err.message, url: webhook.url });
      });
    });
  }

  /**
   * Call individual webhook
   */
  async callWebhook(webhook, eventType, data) {
    const payload = {
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
      webhookId: webhook.id
    };

    // TODO: Implement actual HTTP request
    this.logger.info('Webhook triggered', { url: webhook.url, event: eventType, webhookId: webhook.id });
  }
}

module.exports = ApiRouter;