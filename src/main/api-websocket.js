// UMBRA API v2 - WebSocket module
const { WebSocketServer } = require('ws');
const logger = require('../shared/logger');

class ApiWebSocket {
  constructor(middleware, settingsManager, windowManager, statisticsManager, notificationManager) {
    this.middleware = middleware;
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.statisticsManager = statisticsManager;
    this.notificationManager = notificationManager;
    this.logger = logger;
    
    this.wsServer = null;
    this.clients = new Set();
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Initialize WebSocket server
   */
  init(server, apiKey) {
    this.wsServer = new WebSocketServer({
      server,
      perMessageDeflate: false, // Disable compression for lower latency
      maxPayload: 64 * 1024 // 64KB max message size
    });

    this.wsServer.on('connection', (ws, req) => this.handleConnection(ws, req, apiKey));
    
    return this.wsServer;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req, apiKey) {
    // Check authentication from query parameter or headers
    const url = new URL(req.url, `http://${req.headers.host}`);
    const keyFromQuery = url.searchParams.get('key') || '';
    const authResult = this.middleware.checkAuth(req, apiKey);
    
    // Allow query parameter auth for WebSocket
    if (!authResult.authorized && keyFromQuery !== apiKey) {
      ws.close(1008, 'Invalid API key');
      return;
    }

    // Add client
    this.clients.add(ws);
    
    // Send welcome message
    this.sendToClient(ws, {
      type: 'welcome',
      message: 'Connected to UMBRA API v2 WebSocket',
      timestamp: new Date().toISOString(),
      version: '2.1.1'
    });

    // Send recent event history
    if (this.eventHistory.length > 0) {
      this.sendToClient(ws, {
        type: 'history',
        events: this.eventHistory.slice(-10), // Last 10 events
        timestamp: new Date().toISOString()
      });
    }

    // Setup event handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleClose(ws));
    ws.on('error', (err) => this.handleError(ws, err));

    this.logger.logWebSocket('client_connected', this.clients.size, { ip: authResult.ip });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle ping/pong
      if (message.type === 'ping') {
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        return;
      }

      // Handle subscription requests
      if (message.type === 'subscribe') {
        this.handleSubscription(ws, message);
        return;
      }

      // Handle unsubscribe requests
      if (message.type === 'unsubscribe') {
        this.handleUnsubscription(ws, message);
        return;
      }

      // Unknown message type
      this.sendToClient(ws, {
        type: 'error',
        message: 'Unknown message type',
        received: message.type
      });
    } catch (err) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format',
        error: err.message
      });
    }
  }

  /**
   * Handle subscription to event types
   */
  handleSubscription(ws, message) {
    const eventTypes = message.events || ['*'];
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    eventTypes.forEach(event => ws.subscriptions.add(event));
    
    this.sendToClient(ws, {
      type: 'subscribed',
      events: Array.from(ws.subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle unsubscription from event types
   */
  handleUnsubscription(ws, message) {
    const eventTypes = message.events || ['*'];
    
    if (!ws.subscriptions) {
      return;
    }
    
    if (eventTypes.includes('*')) {
      ws.subscriptions.clear();
    } else {
      eventTypes.forEach(event => ws.subscriptions.delete(event));
    }
    
    this.sendToClient(ws, {
      type: 'unsubscribed',
      events: Array.from(ws.subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client disconnect
   */
  handleClose(ws) {
    this.clients.delete(ws);
    this.logger.logWebSocket('client_disconnected', this.clients.size);
  }

  /**
   * Handle WebSocket error
   */
  handleError(ws, err) {
    this.logger.error('WebSocket error', { error: err.message });
    this.clients.delete(ws);
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, data) {
    if (ws.readyState === 1) { // OPEN
      try {
        ws.send(JSON.stringify(data));
      } catch (err) {
        this.logger.error('Failed to send WebSocket message to client', { error: err.message });
        this.clients.delete(ws);
      }
    }
  }

  /**
   * Broadcast event to all subscribed clients
   */
  broadcast(eventType, data) {
    const event = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Broadcast to subscribed clients
    let sentCount = 0;
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        // Check if client is subscribed to this event type
        if (!client.subscriptions || client.subscriptions.has('*') || client.subscriptions.has(eventType)) {
          try {
            client.send(JSON.stringify(event));
            sentCount++;
          } catch (err) {
            this.logger.error('Failed to broadcast WebSocket message', { error: err.message });
            this.clients.delete(client);
          }
        }
      }
    });

    return sentCount;
  }

  /**
   * Broadcast donation event
   */
  broadcastDonation(donation) {
    return this.broadcast('donation', donation);
  }

  /**
   * Broadcast message event
   */
  broadcastMessage(message) {
    return this.broadcast('message', message);
  }

  /**
   * Broadcast goal update event
   */
  broadcastGoalUpdate(goal) {
    return this.broadcast('goal_update', goal);
  }

  /**
   * Broadcast statistics update event
   */
  broadcastStatsUpdate(stats) {
    return this.broadcast('stats_update', stats);
  }

  /**
   * Broadcast settings update event
   */
  broadcastSettingsUpdate(settings) {
    return this.broadcast('settings_update', settings);
  }

  /**
   * Get client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.wsServer) {
      // Close all client connections
      this.clients.forEach(client => {
        if (client.readyState === 1) {
          client.close(1000, 'Server shutdown');
        }
      });
      this.clients.clear();
      
      // Close server
      this.wsServer.close();
      this.wsServer = null;
    }
  }
}

module.exports = ApiWebSocket;