// HTTP API Server module
const http = require('http');
const crypto = require('crypto');
const CONSTANTS = require('../shared/constants');

class ApiServer {
  constructor(settingsManager, windowManager) {
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.server = null;
    this.rateLimit = new Map();
    this.rateLimitCleanup = null;
  }

  start(port, apiKey) {
    this.stop();

    // Rate limiting cleanup
    this.rateLimitCleanup = setInterval(() => this.rateLimit.clear(), 60000);

    this.server = http.createServer((req, res) => this.handleRequest(req, res, apiKey));

    this.server.on('error', (e) => {
      console.error('UMBRA API error:', e.message);
      const settingsWindow = this.windowManager.getSettingsWindow();
      settingsWindow?.webContents.send('api-error', {
        message: e.message,
        code: e.code,
      });
    });

    this.server.once('close', () => {
      if (this.rateLimitCleanup) {
        clearInterval(this.rateLimitCleanup);
        this.rateLimitCleanup = null;
      }
    });

    this.server.listen(port, '127.0.0.1', () => {
      console.log(`UMBRA API listening on http://127.0.0.1:${port}`);
    });

    return this.server;
  }

  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        console.error('Error closing API server:', e);
      }
      this.server = null;
    }
    if (this.rateLimitCleanup) {
      clearInterval(this.rateLimitCleanup);
      this.rateLimitCleanup = null;
    }
  }

  handleRequest(req, res, apiKey) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth
    const key = req.headers['x-api-key'] || '';
    if (key !== apiKey) {
      res.writeHead(401);
      res.end(JSON.stringify({ ok: false, error: 'Invalid API key' }));
      return;
    }

    // Rate limit
    const clientIp = req.socket.remoteAddress;
    let reqs = (this.rateLimit.get(clientIp) || []).filter(
      (t) => t > Date.now() - 60000
    );
    if (reqs.length >= CONSTANTS.API_RATE_LIMIT) {
      res.writeHead(429);
      res.end(JSON.stringify({ ok: false, error: 'Too many requests' }));
      return;
    }
    this.rateLimit.set(clientIp, [...reqs, Date.now()]);

    const url = req.url.split('?')[0];

    // GET /v1/status
    if (req.method === 'GET' && url === '/v1/status') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          version: '1.0',
          overlay: !!this.windowManager.getOverlayWindow(),
        })
      );
      return;
    }

    // GET /v1/stats
    if (req.method === 'GET' && url === '/v1/stats') {
      const settings = this.settingsManager.get();
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          goal: {
            current: settings.goalCurrent || 0,
            target: settings.goalTarget || 0,
            title: settings.goalTitle || '',
          },
          settings: {
            theme: settings.theme || 'default',
            opacity: settings.opacity || CONSTANTS.OPACITY_DEFAULT,
          },
        })
      );
      return;
    }

    // POST endpoints
    if (req.method === 'POST') {
      this.handlePostRequest(req, res, url);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Unknown endpoint' }));
  }

  handlePostRequest(req, res, url) {
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > CONSTANTS.MAX_BODY_SIZE) {
        res.writeHead(413);
        res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      let data = {};
      try {
        data = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        return;
      }

      const overlay = this.windowManager.getOverlayWindow();
      if (!overlay) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'Overlay not available' }));
        return;
      }

      // POST /v1/donation
      if (url === '/v1/donation') {
        const name = String(data.name || 'anonymous').slice(0, 100);
        const amount = String(data.amount || '0').slice(0, 20);
        const message = String(data.message || '').slice(0, 500);
        const currency = String(data.currency || '').slice(0, 10);

        overlay.webContents.send('api-event', {
          type: 'donation',
          payload: { name, amount, message, currency },
        });

        // Update goal
        const settings = this.settingsManager.get();
        settings.goalCurrent = (settings.goalCurrent || 0) + (parseFloat(amount) || 0);
        this.settingsManager.save(settings);

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /v1/message
      if (url === '/v1/message') {
        const platform = ['twitch', 'youtube', 'kick', 'da', 'api'].includes(data.platform)
          ? data.platform
          : 'api';
        const author = String(data.author || 'anonymous').slice(0, 100);
        const text = String(data.text || '').slice(0, 1000);
        const color = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#a8a8b3';

        overlay.webContents.send('api-event', {
          type: 'message',
          payload: { platform, author, text, color },
        });

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /v1/alert
      if (url === '/v1/alert') {
        const title = String(data.title || 'ALERT').slice(0, 100);
        const text = String(data.text || '').slice(0, 500);
        const icon = String(data.icon || '📢').slice(0, 4);

        overlay.webContents.send('api-event', {
          type: 'alert',
          payload: { title, text, icon },
        });

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /v1/goal
      if (url === '/v1/goal') {
        const settings = this.settingsManager.get();
        if (data.current !== undefined)
          settings.goalCurrent = Math.max(0, parseFloat(data.current) || 0);
        if (data.target !== undefined)
          settings.goalTarget = Math.max(0, parseFloat(data.target) || 0);
        if (data.title !== undefined)
          settings.goalTitle = String(data.title).slice(0, 80);

        this.settingsManager.save(settings);
        overlay.webContents.send('apply-settings', settings);

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /v1/clear-chat
      if (url === '/v1/clear-chat') {
        overlay.webContents.send('apply-settings', {
          ...this.settingsManager.get(),
          _clearChat: true,
        });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // POST /v1/settings
      if (url === '/v1/settings') {
        const settings = this.settingsManager.get();
        if (data.theme) settings.theme = data.theme;
        if (data.opacity !== undefined)
          settings.opacity = Math.min(100, Math.max(20, parseInt(data.opacity) || 85));

        this.settingsManager.save(settings);
        overlay.webContents.send('apply-settings', settings);
        overlay.setOpacity(settings.opacity / 100);

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ ok: false, error: 'Unknown endpoint' }));
    });
  }

  generateApiKey() {
    return crypto.randomBytes(24).toString('hex');
  }
}

module.exports = ApiServer;
