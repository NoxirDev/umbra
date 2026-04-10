// UMBRA API Client for Node.js
// Simple client for integrating UMBRA into Node.js applications

const axios = require('axios');
const WebSocket = require('ws');
const EventEmitter = require('events');

class UmbraClient extends EventEmitter {
  constructor(apiKey, baseUrl = 'http://127.0.0.1:4587/v2') {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.ws = null;
    this.pingInterval = null;
  }

  // ═══════════════════════════════════════════════════════════
  // REST API Methods
  // ═══════════════════════════════════════════════════════════

  async _request(method, endpoint, data = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      if (!response.data.ok) {
        throw new Error(response.data.error || 'API request failed');
      }
      return response.data.data;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  // Donations
  async sendDonation(name, amount, message = '', currency = 'RUB') {
    return await this._request('POST', '/donations', {
      name,
      amount: String(amount),
      message,
      currency
    });
  }

  async getDonations(limit = 50) {
    return await this._request('GET', `/donations?limit=${limit}`);
  }

  // Messages
  async sendMessage(author, text, platform = 'api', color = '#a8a8b3') {
    return await this._request('POST', '/messages', {
      platform,
      author,
      text,
      color
    });
  }

  async getMessages(limit = 100) {
    return await this._request('GET', `/messages?limit=${limit}`);
  }

  // Alerts
  async sendAlert(title, text = '', icon = '📢', duration = 5000) {
    return await this._request('POST', '/alerts', {
      title,
      text,
      icon,
      duration
    });
  }

  // Goal
  async getGoal() {
    return await this._request('GET', '/goal');
  }

  async updateGoal(current, target, title) {
    const data = {};
    if (current !== undefined) data.current = current;
    if (target !== undefined) data.target = target;
    if (title !== undefined) data.title = title;
    return await this._request('PATCH', '/goal', data);
  }

  async resetGoal() {
    return await this._request('POST', '/goal/reset');
  }

  // Chat
  async clearChat() {
    return await this._request('DELETE', '/chat');
  }

  // Settings
  async getSettings() {
    return await this._request('GET', '/settings');
  }

  async updateSettings(settings) {
    return await this._request('PATCH', '/settings', settings);
  }

  // Stats
  async getStats() {
    return await this._request('GET', '/stats');
  }

  async getStatus() {
    return await this._request('GET', '/status');
  }

  async getHealth() {
    return await this._request('GET', '/health');
  }

  // Events
  async getEvents(limit = 100) {
    return await this._request('GET', `/events?limit=${limit}`);
  }

  // Webhooks
  async getWebhooks() {
    return await this._request('GET', '/webhooks');
  }

  async createWebhook(url, events = ['donation', 'message']) {
    return await this._request('POST', '/webhooks', { url, events });
  }

  async deleteWebhook(id) {
    return await this._request('DELETE', `/webhooks/${id}`);
  }

  // OBS
  async getOBSConfig() {
    return await this._request('GET', '/obs/config');
  }

  // ═══════════════════════════════════════════════════════════
  // WebSocket Methods
  // ═══════════════════════════════════════════════════════════

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('/v2', '');
      this.ws = new WebSocket(`${wsUrl}?key=${this.apiKey}`);

      this.ws.on('open', () => {
        console.log('[UMBRA] WebSocket connected');
        this.emit('connected');
        this.startPing();
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('[UMBRA] WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[UMBRA] WebSocket disconnected');
        this.emit('disconnected');
        this.stopPing();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (e) {
          console.error('[UMBRA] Failed to parse message:', e);
        }
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.stopPing();
      this.ws.close();
      this.ws = null;
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    // Emit specific event
    this.emit(type, data || message);

    // Emit wildcard event
    this.emit('*', message);
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

module.exports = UmbraClient;

// Example usage
if (require.main === module) {
  const client = new UmbraClient('your_api_key_here');

  // REST API examples
  (async () => {
    try {
      console.log('Sending donation...');
      const donation = await client.sendDonation('Test User', 100, 'Great stream!');
      console.log('Donation sent:', donation);

      console.log('\nGetting stats...');
      const stats = await client.getStats();
      console.log(`Goal: ${stats.goal.current}/${stats.goal.target}`);

      // WebSocket example
      client.on('donation', (data) => {
        console.log(`New donation: ${data.name} - ${data.amount}`);
      });

      client.on('message', (data) => {
        console.log(`New message: ${data.author}: ${data.text}`);
      });

      console.log('\nConnecting to WebSocket...');
      await client.connect();

      // Keep running
      process.on('SIGINT', () => {
        console.log('\nDisconnecting...');
        client.disconnect();
        process.exit(0);
      });

    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
