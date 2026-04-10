// UMBRA API Client for JavaScript (Browser)
// Simple client for integrating UMBRA into web applications

class UmbraClient {
  constructor(apiKey, baseUrl = 'http://127.0.0.1:4587/v2') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.ws = null;
    this.eventHandlers = {};
  }

  // ═══════════════════════════════════════════════════════════
  // REST API Methods
  // ═══════════════════════════════════════════════════════════

  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || 'API request failed');
    }

    return result.data;
  }

  // Donations
  async sendDonation(name, amount, message, currency = 'RUB') {
    return await this.request('POST', '/donations', {
      name,
      amount: String(amount),
      message,
      currency
    });
  }

  async getDonations(limit = 50) {
    return await this.request('GET', `/donations?limit=${limit}`);
  }

  // Messages
  async sendMessage(author, text, platform = 'api', color = '#a8a8b3') {
    return await this.request('POST', '/messages', {
      platform,
      author,
      text,
      color
    });
  }

  async getMessages(limit = 100) {
    return await this.request('GET', `/messages?limit=${limit}`);
  }

  // Alerts
  async sendAlert(title, text, icon = '📢', duration = 5000) {
    return await this.request('POST', '/alerts', {
      title,
      text,
      icon,
      duration
    });
  }

  // Goal
  async getGoal() {
    return await this.request('GET', '/goal');
  }

  async updateGoal(current, target, title) {
    const data = {};
    if (current !== undefined) data.current = current;
    if (target !== undefined) data.target = target;
    if (title !== undefined) data.title = title;
    return await this.request('PATCH', '/goal', data);
  }

  async resetGoal() {
    return await this.request('POST', '/goal/reset');
  }

  // Chat
  async clearChat() {
    return await this.request('DELETE', '/chat');
  }

  // Settings
  async getSettings() {
    return await this.request('GET', '/settings');
  }

  async updateSettings(settings) {
    return await this.request('PATCH', '/settings', settings);
  }

  // Stats
  async getStats() {
    return await this.request('GET', '/stats');
  }

  async getStatus() {
    return await this.request('GET', '/status');
  }

  async getHealth() {
    return await this.request('GET', '/health');
  }

  // Events
  async getEvents(limit = 100) {
    return await this.request('GET', `/events?limit=${limit}`);
  }

  // Webhooks
  async getWebhooks() {
    return await this.request('GET', '/webhooks');
  }

  async createWebhook(url, events = ['donation', 'message']) {
    return await this.request('POST', '/webhooks', { url, events });
  }

  async deleteWebhook(id) {
    return await this.request('DELETE', `/webhooks/${id}`);
  }

  // OBS
  async getOBSConfig() {
    return await this.request('GET', '/obs/config');
  }

  // ═══════════════════════════════════════════════════════════
  // WebSocket Methods
  // ═══════════════════════════════════════════════════════════

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('/v2', '');
      this.ws = new WebSocket(`${wsUrl}?key=${this.apiKey}`);

      this.ws.onopen = () => {
        console.log('[UMBRA] WebSocket connected');
        this.startPing();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[UMBRA] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[UMBRA] WebSocket disconnected');
        this.stopPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (e) {
          console.error('[UMBRA] Failed to parse message:', e);
        }
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.stopPing();
      this.ws.close();
      this.ws = null;
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  off(eventType, handler) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = this.eventHandlers[eventType].filter(h => h !== handler);
    }
  }

  handleEvent(data) {
    const handlers = this.eventHandlers[data.type] || [];
    handlers.forEach(handler => {
      try {
        handler(data.data || data);
      } catch (e) {
        console.error('[UMBRA] Event handler error:', e);
      }
    });

    // Call wildcard handlers
    const wildcardHandlers = this.eventHandlers['*'] || [];
    wildcardHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error('[UMBRA] Wildcard handler error:', e);
      }
    });
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

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UmbraClient;
}
