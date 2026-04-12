// UMBRA API v2 - Professional REST + WebSocket API
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const CONSTANTS = require('../shared/constants');

class ApiServerV2 {
  constructor(settingsManager, windowManager, statisticsManager, notificationManager) {
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.statisticsManager = statisticsManager;
    this.notificationManager = notificationManager;
    this.httpServer = null;
    this.wsServer = null;
    this.rateLimit = new Map();
    this.rateLimitCleanup = null;

    // Event history with optimized limits
    this.donationHistory = [];
    this.messageHistory = [];
    this.maxHistorySize = 500; // Reduced from 1000

    // Webhooks
    this.webhooks = [];

    // WebSocket clients
    this.wsClients = new Set();

    // OBS pages cache
    this.obsPageCache = new Map();
    this.cacheOBSPages();
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
        console.error(`Failed to cache OBS page ${page}:`, err.message);
      }
    });
  }

  start(port, apiKey) {
    this.stop();

    // Rate limiting cleanup - optimized interval
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
    }, 30000); // Every 30s instead of clearing all

    // HTTP Server
    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res, apiKey));

    // WebSocket Server with optimized settings
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      perMessageDeflate: false, // Disable compression for lower latency
      maxPayload: 64 * 1024 // 64KB max message size
    });
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

    // Auth - skip for localhost
    const clientIp = req.socket.remoteAddress;
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

    if (!isLocalhost) {
      const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || '';
      if (key !== apiKey) {
        this.sendError(res, 401, 'Invalid API key');
        return;
      }
    }

    // Rate limit
    if (!this.checkRateLimit(req, res)) return;

    const url = req.url.split('?')[0];
    const method = req.method;

    // Route to handlers
    this.routeRequest(method, url, req, res);
  }

  routeRequest(method, url, req, res) {
    // Web Dashboard
    if (method === 'GET' && (url === '/dashboard' || url === '/')) {
      return this.serveWebDashboard(req, res);
    }

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

    // Statistics
    if (url.startsWith('/v2/statistics')) {
      return this.handleStatistics(method, url, req, res);
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
    const totalEvents = this.donationHistory.length + this.messageHistory.length;

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
        total_events: totalEvents,
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

        // Save to history with auto-cleanup
        this.donationHistory.unshift(donation);
        if (this.donationHistory.length > this.maxHistorySize) {
          this.donationHistory.length = this.maxHistorySize; // Truncate instead of pop
        }

        // Record in statistics
        if (this.statisticsManager) {
          this.statisticsManager.recordDonation(donation);
        }

        // Show desktop notification
        if (this.notificationManager) {
          this.notificationManager.notifyDonation(donation);
        }

        // Check if goal reached (reuse settings from above)
        if (settings.goalTarget > 0 && settings.goalCurrent >= settings.goalTarget) {
          if (this.notificationManager) {
            this.notificationManager.notifyGoalReached({
              title: settings.goalTitle,
              current: settings.goalCurrent,
              target: settings.goalTarget,
            });
          }
        }

        // Broadcast to WebSocket clients
        this.broadcast({ type: 'donation', data: donation });

        // Trigger webhooks
        this.triggerWebhooks('donation', donation);

        this.sendSuccess(res, donation, 201);
      });
    }

    if (method === 'GET' && url === '/v2/donations') {
      const limit = Math.min(parseInt(req.url.split('limit=')[1]) || 50, this.maxHistorySize);
      this.sendSuccess(res, {
        donations: this.donationHistory.slice(0, limit),
        total: this.donationHistory.length,
      });
      return;
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

        // Save to history with auto-cleanup
        this.messageHistory.unshift(message);
        if (this.messageHistory.length > this.maxHistorySize) {
          this.messageHistory.length = this.maxHistorySize; // Truncate
        }

        // Record in statistics
        if (this.statisticsManager) {
          this.statisticsManager.recordMessage();
        }

        // Broadcast to WebSocket clients
        this.broadcast({ type: 'message', data: message });

        // Trigger webhooks
        this.triggerWebhooks('message', message);

        this.sendSuccess(res, message, 201);
      });
    }

    if (method === 'GET' && url === '/v2/messages') {
      const limit = Math.min(parseInt(req.url.split('limit=')[1]) || 100, this.maxHistorySize);
      this.sendSuccess(res, {
        messages: this.messageHistory.slice(0, limit),
        total: this.messageHistory.length,
      });
      return;
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
      return this.sendSuccess(res, { current: 0, target: settings.goalTarget });
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

      return this.sendSuccess(res, {
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

  handleStatistics(method, url, req, res) {
    if (!this.statisticsManager) {
      return this.sendError(res, 503, 'Statistics not available');
    }

    // Get all-time statistics
    if (method === 'GET' && url === '/v2/statistics') {
      const stats = this.statisticsManager.getAllTimeStats();
      return this.sendSuccess(res, stats);
    }

    // Get top donators
    if (method === 'GET' && url.startsWith('/v2/statistics/top')) {
      const limit = parseInt(req.url.split('limit=')[1]) || 10;
      const topDonators = this.statisticsManager.getTopDonators(Math.min(limit, 100));
      return this.sendSuccess(res, {
        top_donators: topDonators,
        total: topDonators.length,
      });
    }

    // Get recent sessions
    if (method === 'GET' && url.startsWith('/v2/statistics/sessions')) {
      const limit = parseInt(req.url.split('limit=')[1]) || 10;
      const sessions = this.statisticsManager.getRecentSessions(Math.min(limit, 30));
      return this.sendSuccess(res, {
        sessions,
        total: sessions.length,
      });
    }

    // Export statistics
    if (method === 'GET' && url === '/v2/statistics/export') {
      const exportData = this.statisticsManager.export();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="umbra-stats-${Date.now()}.json"`,
      });
      res.end(JSON.stringify(exportData, null, 2));
      return;
    }

    // Import statistics
    if (method === 'POST' && url === '/v2/statistics/import') {
      return this.readBody(req, res, (data) => {
        const success = this.statisticsManager.import(data);
        if (success) {
          this.sendSuccess(res, { imported: true });
        } else {
          this.sendError(res, 400, 'Import failed');
        }
      });
    }

    // Reset statistics
    if (method === 'POST' && url === '/v2/statistics/reset') {
      this.statisticsManager.reset();
      return this.sendSuccess(res, { reset: true });
    }

    this.sendError(res, 405, 'Method not allowed');
  }

  /**
   * Serve OBS pages from cache (optimized)
   */
  serveOBSPage(url, req, res) {
    // Map URL to page name
    let pageName;
    if (url.startsWith('/obs/overlay')) pageName = 'overlay';
    else if (url.startsWith('/obs/chat')) pageName = 'chat';
    else if (url.startsWith('/obs/donations')) pageName = 'donations';
    else if (url.startsWith('/obs/goal')) pageName = 'goal';
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    // Serve from cache
    const content = this.obsPageCache.get(pageName);
    if (content) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Page not found');
    }
  }

  /**
   * Serve web dashboard
   */
  serveWebDashboard(req, res) {
    const dashboardPath = path.join(__dirname, '..', 'renderer', 'web', 'dashboard.html');
    try {
      if (fs.existsSync(dashboardPath)) {
        const content = fs.readFileSync(dashboardPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Dashboard not found');
      }
    } catch (error) {
      console.error('Failed to serve dashboard:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET HANDLER
  // ═══════════════════════════════════════════════════════════

  handleWebSocket(ws, req, apiKey) {
    const url = new URL(req.url, 'ws://localhost');
    const key = url.searchParams.get('key') || '';

    // Skip auth for localhost
    const clientIp = req.socket.remoteAddress;
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

    if (!isLocalhost && key !== apiKey) {
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
        // Validate message size
        if (data.length > CONSTANTS.MAX_BODY_SIZE) {
          ws.close(1009, 'Message too large');
          return;
        }

        const msg = JSON.parse(data);

        // Validate message structure
        if (!msg || typeof msg !== 'object') {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
          return;
        }

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

  /**
   * Broadcast message to all connected WebSocket clients (optimized)
   */
  broadcast(data) {
    if (this.wsClients.size === 0) return;

    const message = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Remove dead connections while broadcasting
    const deadClients = [];
    this.wsClients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(message);
        } catch (err) {
          deadClients.push(client);
        }
      } else if (client.readyState > 1) { // CLOSING or CLOSED
        deadClients.push(client);
      }
    });

    // Clean up dead connections
    deadClients.forEach(client => this.wsClients.delete(client));
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

  /**
   * Optimized rate limiting check
   */
  checkRateLimit(req, res) {
    const clientIp = req.socket.remoteAddress;
    const now = Date.now();
    const windowStart = now - 60000;

    let requests = this.rateLimit.get(clientIp);
    if (!requests) {
      this.rateLimit.set(clientIp, [now]);
      return true;
    }

    // Filter old requests
    requests = requests.filter(t => t > windowStart);

    if (requests.length >= CONSTANTS.API_RATE_LIMIT) {
      this.sendError(res, 429, 'Too many requests');
      return false;
    }

    requests.push(now);
    this.rateLimit.set(clientIp, requests);
    return true;
  }

  /**
   * Optimized body reading with streaming
   */
  readBody(req, res, callback) {
    let body = '';
    let size = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > CONSTANTS.MAX_BODY_SIZE) {
        aborted = true;
        this.sendError(res, 413, 'Payload too large');
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        const data = body ? JSON.parse(body) : {};
        callback(data);
      } catch {
        this.sendError(res, 400, 'Invalid JSON');
      }
    });

    req.on('error', () => {
      if (aborted) return;
      aborted = true;
      this.sendError(res, 400, 'Request error');
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
