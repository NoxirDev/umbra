// UMBRA API v2 - Professional REST + WebSocket API
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');

class ApiServerV2 {
  constructor(settingsManager, windowManager) {
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.httpServer = null;
    this.wsServer = null;
    this.rateLimit = new Map();
    this.rateLimitCleanup = null;

    // Event history
    this.donationHistory = [];
    this.messageHistory = [];
    this.eventHistory = [];
    this.maxHistorySize = 1000;

    // Webhooks
    this.webhooks = [];

    // WebSocket clients
    this.wsClients = new Set();
  }

  start(port, apiKey) {
    this.stop();

    // Rate limiting cleanup
    this.rateLimitCleanup = setInterval(() => this.rateLimit.clear(), 60000);

    // HTTP Server
    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res, apiKey));

    // WebSocket Server
    this.wsServer = new WebSocketServer({ server: this.httpServer });
    this.wsServer.on('connection', (ws, req) => this.handleWebSocket(ws, req, apiKey));

    this.httpServer.on('error', (e) => {
      console.error('UMBRA API v2 error:', e.message);
      const settingsWindow = this.windowManager.getSettingsWindow();
      settingsWindow?.webContents.send('api-error', {
        message: e.message,
        code: e.code,
      });
    });

    this.httpServer.once('close', () => {
      if (this.rateLimitCleanup) {
        clearInterval(this.rateLimitCleanup);
        this.rateLimitCleanup = null;
      }
    });

    this.httpServer.listen(port, '127.0.0.1', () => {
      console.log(`UMBRA API v2 listening on http://127.0.0.1:${port}`);
      console.log(`WebSocket available at ws://127.0.0.1:${port}`);
    });

    return this.httpServer;
  }

  stop() {
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
    if (this.httpServer) {
      try {
        this.httpServer.close();
      } catch (e) {
        console.error('Error closing API server:', e);
      }
      this.httpServer = null;
    }
    if (this.rateLimitCleanup) {
      clearInterval(this.rateLimitCleanup);
      this.rateLimitCleanup = null;
    }
    this.wsClients.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // HTTP REQUEST HANDLER
  // ═══════════════════════════════════════════════════════════

  handleRequest(req, res, apiKey) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth
    const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || '';
    if (key !== apiKey) {
      this.sendError(res, 401, 'Invalid API key');
      return;
    }

    // Rate limit
    if (!this.checkRateLimit(req, res)) return;

    const url = req.url.split('?')[0];
    const method = req.method;

    // Route to handlers
    this.routeRequest(method, url, req, res);
  }

  routeRequest(method, url, req, res) {
    // OBS Browser Source pages (serve HTML files)
    if (method === 'GET' && url.startsWith('/obs/')) {
      return this.serveOBSPage(url, req, res);
    }

    // API Info
    if (method === 'GET' && url === '/v2') {
      return this.handleApiInfo(req, res);
    }

    // Health check
    if (method === 'GET' && url === '/v2/health') {
      return this.handleHealth(req, res);
    }

    // Status
    if (method === 'GET' && url === '/v2/status') {
      return this.handleStatus(req, res);
    }

    // Statistics
    if (method === 'GET' && url === '/v2/stats') {
      return this.handleStats(req, res);
    }

    // Donations
    if (url.startsWith('/v2/donations')) {
      return this.handleDonations(method, url, req, res);
    }

    // Messages
    if (url.startsWith('/v2/messages')) {
      return this.handleMessages(method, url, req, res);
    }

    // Alerts
    if (url.startsWith('/v2/alerts')) {
      return this.handleAlerts(method, url, req, res);
    }

    // Goal
    if (url.startsWith('/v2/goal')) {
      return this.handleGoal(method, url, req, res);
    }

    // Chat
    if (url.startsWith('/v2/chat')) {
      return this.handleChat(method, url, req, res);
    }

    // Settings
    if (url.startsWith('/v2/settings')) {
      return this.handleSettings(method, url, req, res);
    }

    // Events history
    if (url.startsWith('/v2/events')) {
      return this.handleEvents(method, url, req, res);
    }

    // Webhooks
    if (url.startsWith('/v2/webhooks')) {
      return this.handleWebhooks(method, url, req, res);
    }

    // OBS Integration
    if (url.startsWith('/v2/obs')) {
      return this.handleOBS(method, url, req, res);
    }

    this.sendError(res, 404, 'Endpoint not found');
  }

  // ═══════════════════════════════════════════════════════════
  // ENDPOINT HANDLERS
  // ═══════════════════════════════════════════════════════════

  handleApiInfo(req, res) {
    this.sendSuccess(res, {
      name: 'UMBRA API',
      version: '2.0.0',
      author: 'Noxir (KayROSir)',
      endpoints: {
        rest: 'http://127.0.0.1:4587/v2',
        websocket: 'ws://127.0.0.1:4587',
        documentation: 'http://127.0.0.1:4587/v2/docs',
      },
      features: [
        'REST API',
        'WebSocket real-time events',
        'Webhooks',
        'OBS Browser Source',
        'Event history',
        'Rate limiting',
      ],
    });
  }

  handleHealth(req, res) {
    this.sendSuccess(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      overlay: !!this.windowManager.getOverlayWindow(),
      websocket_clients: this.wsClients.size,
    });
  }

  handleStatus(req, res) {
    const settings = this.settingsManager.get();
    this.sendSuccess(res, {
      overlay: {
        visible: !!this.windowManager.getOverlayWindow(),
        opacity: settings.opacity || 85,
        theme: settings.theme || 'default',
      },
      connections: {
        twitch: !!settings.twitchChannel,
        donationalerts: !!settings.daToken,
      },
      api: {
        port: 4587,
        websocket_clients: this.wsClients.size,
        webhooks: this.webhooks.length,
      },
    });
  }

  handleStats(req, res) {
    const settings = this.settingsManager.get();
    this.sendSuccess(res, {
      goal: {
        current: settings.goalCurrent || 0,
        target: settings.goalTarget || 0,
        title: settings.goalTitle || '',
        percentage: settings.goalTarget > 0
          ? Math.min(100, (settings.goalCurrent / settings.goalTarget) * 100).toFixed(2)
          : 0,
      },
      history: {
        donations: this.donationHistory.length,
        messages: this.messageHistory.length,
        events: this.eventHistory.length,
      },
      session: {
        total_donations: this.donationHistory.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0),
        total_messages: this.messageHistory.length,
      },
    });
  }

  handleDonations(method, url, req, res) {
    if (method === 'POST' && url === '/v2/donations') {
      return this.readBody(req, res, (data) => {
        const donation = {
          id: crypto.randomUUID(),
          name: String(data.name || 'Anonymous').slice(0, 100),
          amount: String(data.amount || '0').slice(0, 20),
          message: String(data.message || '').slice(0, 500),
          currency: String(data.currency || 'RUB').slice(0, 10),
          platform: data.platform || 'api',
          timestamp: new Date().toISOString(),
        };

        // Send to overlay
        const overlay = this.windowManager.getOverlayWindow();
        if (overlay) {
          overlay.webContents.send('api-event', {
            type: 'donation',
            payload: donation,
          });
        }

        // Update goal
        const settings = this.settingsManager.get();
        settings.goalCurrent = (settings.goalCurrent || 0) + (parseFloat(donation.amount) || 0);
        this.settingsManager.save(settings);

        // Save to history
        this.donationHistory.unshift(donation);
        if (this.donationHistory.length > this.maxHistorySize) {
          this.donationHistory.pop();
        }

        // Broadcast to WebSocket clients
        this.broadcast({ type: 'donation', data: donation });

        // Trigger webhooks
        this.triggerWebhooks('donation', donation);

        this.sendSuccess(res, donation, 201);
      });
    }

    if (method === 'GET' && url === '/v2/donations') {
      const limit = parseInt(req.url.split('limit=')[1]) || 50;
      this.sendSuccess(res, {
        donations: this.donationHistory.slice(0, limit),
        total: this.donationHistory.length,
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleMessages(method, url, req, res) {
    if (method === 'POST' && url === '/v2/messages') {
      return this.readBody(req, res, (data) => {
        const message = {
          id: crypto.randomUUID(),
          platform: ['twitch', 'youtube', 'kick', 'da', 'api'].includes(data.platform)
            ? data.platform
            : 'api',
          author: String(data.author || 'Anonymous').slice(0, 100),
          text: String(data.text || '').slice(0, 1000),
          color: /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#a8a8b3',
          timestamp: new Date().toISOString(),
        };

        // Send to overlay
        const overlay = this.windowManager.getOverlayWindow();
        if (overlay) {
          overlay.webContents.send('api-event', {
            type: 'message',
            payload: message,
          });
        }

        // Save to history
        this.messageHistory.unshift(message);
        if (this.messageHistory.length > this.maxHistorySize) {
          this.messageHistory.pop();
        }

        // Broadcast to WebSocket clients
        this.broadcast({ type: 'message', data: message });

        // Trigger webhooks
        this.triggerWebhooks('message', message);

        this.sendSuccess(res, message, 201);
      });
    }

    if (method === 'GET' && url === '/v2/messages') {
      const limit = parseInt(req.url.split('limit=')[1]) || 100;
      this.sendSuccess(res, {
        messages: this.messageHistory.slice(0, limit),
        total: this.messageHistory.length,
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleAlerts(method, url, req, res) {
    if (method === 'POST' && url === '/v2/alerts') {
      return this.readBody(req, res, (data) => {
        const alert = {
          id: crypto.randomUUID(),
          title: String(data.title || 'ALERT').slice(0, 100),
          text: String(data.text || '').slice(0, 500),
          icon: String(data.icon || '📢').slice(0, 4),
          duration: Math.min(30000, Math.max(1000, parseInt(data.duration) || 5000)),
          timestamp: new Date().toISOString(),
        };

        const overlay = this.windowManager.getOverlayWindow();
        if (overlay) {
          overlay.webContents.send('api-event', {
            type: 'alert',
            payload: alert,
          });
        }

        this.broadcast({ type: 'alert', data: alert });
        this.triggerWebhooks('alert', alert);

        this.sendSuccess(res, alert, 201);
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleGoal(method, url, req, res) {
    const settings = this.settingsManager.get();

    if (method === 'GET' && url === '/v2/goal') {
      return this.sendSuccess(res, {
        current: settings.goalCurrent || 0,
        target: settings.goalTarget || 0,
        title: settings.goalTitle || '',
        percentage: settings.goalTarget > 0
          ? Math.min(100, (settings.goalCurrent / settings.goalTarget) * 100).toFixed(2)
          : 0,
      });
    }

    if (method === 'PATCH' && url === '/v2/goal') {
      return this.readBody(req, res, (data) => {
        if (data.current !== undefined)
          settings.goalCurrent = Math.max(0, parseFloat(data.current) || 0);
        if (data.target !== undefined)
          settings.goalTarget = Math.max(0, parseFloat(data.target) || 0);
        if (data.title !== undefined)
          settings.goalTitle = String(data.title).slice(0, 80);

        this.settingsManager.save(settings);

        const overlay = this.windowManager.getOverlayWindow();
        if (overlay) {
          overlay.webContents.send('apply-settings', settings);
        }

        const goalData = {
          current: settings.goalCurrent,
          target: settings.goalTarget,
          title: settings.goalTitle,
        };

        this.broadcast({ type: 'goal_update', data: goalData });
        this.triggerWebhooks('goal_update', goalData);

        this.sendSuccess(res, goalData);
      });
    }

    if (method === 'POST' && url === '/v2/goal/reset') {
      settings.goalCurrent = 0;
      this.settingsManager.save(settings);

      const overlay = this.windowManager.getOverlayWindow();
      if (overlay) {
        overlay.webContents.send('apply-settings', settings);
      }

      this.broadcast({ type: 'goal_reset', data: { current: 0 } });
      this.sendSuccess(res, { current: 0, target: settings.goalTarget });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleChat(method, url, req, res) {
    if (method === 'DELETE' && url === '/v2/chat') {
      const overlay = this.windowManager.getOverlayWindow();
      if (overlay) {
        overlay.webContents.send('apply-settings', {
          ...this.settingsManager.get(),
          _clearChat: true,
        });
      }

      this.messageHistory = [];
      this.broadcast({ type: 'chat_cleared' });

      return this.sendSuccess(res, { cleared: true });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleSettings(method, url, req, res) {
    const settings = this.settingsManager.get();

    if (method === 'GET' && url === '/v2/settings') {
      return this.sendSuccess(res, {
        theme: settings.theme || 'default',
        opacity: settings.opacity || 85,
        autoHide: settings.autoHide || 0,
        donationSound: settings.donationSound !== false,
        donationDuration: settings.donationDuration || 8,
      });
    }

    if (method === 'PATCH' && url === '/v2/settings') {
      return this.readBody(req, res, (data) => {
        if (data.theme) settings.theme = data.theme;
        if (data.opacity !== undefined)
          settings.opacity = Math.min(100, Math.max(20, parseInt(data.opacity) || 85));
        if (data.autoHide !== undefined)
          settings.autoHide = Math.max(0, parseInt(data.autoHide) || 0);
        if (data.donationSound !== undefined)
          settings.donationSound = !!data.donationSound;
        if (data.donationDuration !== undefined)
          settings.donationDuration = Math.min(30, Math.max(3, parseInt(data.donationDuration) || 8));

        this.settingsManager.save(settings);

        const overlay = this.windowManager.getOverlayWindow();
        if (overlay) {
          overlay.webContents.send('apply-settings', settings);
          overlay.setOpacity(settings.opacity / 100);
        }

        this.sendSuccess(res, { updated: true });
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleEvents(method, url, req, res) {
    if (method === 'GET' && url === '/v2/events') {
      const limit = parseInt(req.url.split('limit=')[1]) || 100;
      const events = [
        ...this.donationHistory.map(d => ({ type: 'donation', ...d })),
        ...this.messageHistory.map(m => ({ type: 'message', ...m })),
      ]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      this.sendSuccess(res, {
        events,
        total: events.length,
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleWebhooks(method, url, req, res) {
    if (method === 'GET' && url === '/v2/webhooks') {
      return this.sendSuccess(res, { webhooks: this.webhooks });
    }

    if (method === 'POST' && url === '/v2/webhooks') {
      return this.readBody(req, res, (data) => {
        const webhook = {
          id: crypto.randomUUID(),
          url: data.url,
          events: data.events || ['donation', 'message'],
          enabled: data.enabled !== false,
          created: new Date().toISOString(),
        };

        this.webhooks.push(webhook);
        this.sendSuccess(res, webhook, 201);
      });
    }

    if (method === 'DELETE' && url.startsWith('/v2/webhooks/')) {
      const id = url.split('/')[3];
      const index = this.webhooks.findIndex(w => w.id === id);
      if (index !== -1) {
        this.webhooks.splice(index, 1);
        return this.sendSuccess(res, { deleted: true });
      }
      return this.sendError(res, 404, 'Webhook not found');
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  handleOBS(method, url, req, res) {
    if (method === 'GET' && url === '/v2/obs/config') {
      const settings = this.settingsManager.get();
      return this.sendSuccess(res, {
        overlay_url: `http://127.0.0.1:4587/obs/overlay?key=${settings.apiKey}`,
        chat_url: `http://127.0.0.1:4587/obs/chat?key=${settings.apiKey}`,
        donations_url: `http://127.0.0.1:4587/obs/donations?key=${settings.apiKey}`,
        goal_url: `http://127.0.0.1:4587/obs/goal?key=${settings.apiKey}`,
      });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  serveOBSPage(url, req, res) {
    const fs = require('fs');
    const path = require('path');

    // Map URL to file
    let filePath;
    if (url.startsWith('/obs/overlay')) {
      filePath = path.join(__dirname, '..', 'renderer', 'obs', 'overlay.html');
    } else if (url.startsWith('/obs/chat')) {
      filePath = path.join(__dirname, '..', 'renderer', 'obs', 'chat.html');
    } else if (url.startsWith('/obs/donations')) {
      filePath = path.join(__dirname, '..', 'renderer', 'obs', 'donations.html');
    } else if (url.startsWith('/obs/goal')) {
      filePath = path.join(__dirname, '..', 'renderer', 'obs', 'goal.html');
    } else {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    // Read and serve file
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read OBS file:', err);
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET HANDLER
  // ═══════════════════════════════════════════════════════════

  handleWebSocket(ws, req, apiKey) {
    const url = new URL(req.url, 'ws://localhost');
    const key = url.searchParams.get('key') || '';

    if (key !== apiKey) {
      ws.close(1008, 'Invalid API key');
      return;
    }

    this.wsClients.add(ws);
    console.log(`WebSocket client connected (${this.wsClients.size} total)`);

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to UMBRA API v2',
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        this.handleWebSocketMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      this.wsClients.delete(ws);
      console.log(`WebSocket client disconnected (${this.wsClients.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      this.wsClients.delete(ws);
    });
  }

  handleWebSocketMessage(ws, msg) {
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    }
  }

  broadcast(data) {
    const message = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.wsClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════

  triggerWebhooks(event, data) {
    this.webhooks
      .filter(w => w.enabled && w.events.includes(event))
      .forEach(webhook => {
        const payload = {
          event,
          data,
          timestamp: new Date().toISOString(),
        };

        // Send webhook (non-blocking)
        fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(err => {
          console.error(`Webhook error (${webhook.url}):`, err.message);
        });
      });
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  checkRateLimit(req, res) {
    const clientIp = req.socket.remoteAddress;
    let reqs = (this.rateLimit.get(clientIp) || []).filter(
      (t) => t > Date.now() - 60000
    );
    if (reqs.length >= CONSTANTS.API_RATE_LIMIT) {
      this.sendError(res, 429, 'Too many requests');
      return false;
    }
    this.rateLimit.set(clientIp, [...reqs, Date.now()]);
    return true;
  }

  readBody(req, res, callback) {
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > CONSTANTS.MAX_BODY_SIZE) {
        this.sendError(res, 413, 'Payload too large');
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        callback(data);
      } catch {
        this.sendError(res, 400, 'Invalid JSON');
      }
    });
  }

  sendSuccess(res, data, status = 200) {
    res.writeHead(status);
    res.end(JSON.stringify({
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    }));
  }

  sendError(res, status, message) {
    res.writeHead(status);
    res.end(JSON.stringify({
      ok: false,
      error: message,
      timestamp: new Date().toISOString(),
    }));
  }

  generateApiKey() {
    return crypto.randomBytes(24).toString('hex');
  }
}

module.exports = ApiServerV2;
