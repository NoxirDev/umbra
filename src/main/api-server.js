// UMBRA API v2 - Main server module (refactored)
const http = require('http');
const ApiMiddleware = require('./api-middleware');
const ApiWebSocket = require('./api-websocket');
const ApiRouter = require('./api-router');
const CONSTANTS = require('../shared/constants');

class ApiServerV2 {
  constructor(settingsManager, windowManager, statisticsManager, notificationManager) {
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.statisticsManager = statisticsManager;
    this.notificationManager = notificationManager;
    
    // Initialize modules
    this.middleware = new ApiMiddleware(settingsManager);
    this.websocket = new ApiWebSocket(
      this.middleware,
      settingsManager,
      windowManager,
      statisticsManager,
      notificationManager
    );
    this.router = new ApiRouter(
      this.middleware,
      this.websocket,
      settingsManager,
      windowManager,
      statisticsManager,
      notificationManager
    );
    
    // Server instances
    this.httpServer = null;
  }

  /**
   * Start API server
   */
  start(port, apiKey) {
    this.stop(); // Ensure clean state
    
    // Initialize rate limiting
    this.middleware.initRateLimitCleanup();
    
    // Create HTTP server
    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res, apiKey));
    
    // Initialize WebSocket server
    this.websocket.init(this.httpServer, apiKey);
    
    // Setup error handling
    this.httpServer.on('error', (e) => this.handleServerError(e));
    this.httpServer.once('close', () => this.handleServerClose());
    
    // Start listening
    this.httpServer.listen(port, '127.0.0.1', () => {
      console.log(`UMBRA API v2 listening on http://127.0.0.1:${port}`);
      console.log(`WebSocket available at ws://127.0.0.1:${port}`);
      console.log(`Dashboard: http://127.0.0.1:${port}/dashboard`);
    });
    
    return this.httpServer;
  }

  /**
   * Stop API server
   */
  stop() {
    // Close WebSocket server
    this.websocket.close();
    
    // Close HTTP server
    if (this.httpServer) {
      try {
        this.httpServer.close();
      } catch (e) {
        console.error('Error closing API server:', e);
      }
      this.httpServer = null;
    }
    
    // Cleanup middleware
    this.middleware.cleanup();
    
    console.log('UMBRA API v2 stopped');
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(req, res, apiKey) {
    // Set CORS headers
    this.middleware.setCorsHeaders(res);
    
    // Handle OPTIONS request
    if (this.middleware.handleOptions(req, res)) {
      return;
    }
    
    try {
      // Route the request
      await this.router.routeRequest(req, res, apiKey);
    } catch (err) {
      console.error('[API Server] Unhandled error:', err);
      this.middleware.sendError(res, 500, 'Internal server error');
    }
  }

  /**
   * Handle server error
   */
  handleServerError(e) {
    console.error('UMBRA API v2 error:', e.message);
    
    // Notify settings window
    const settingsWindow = this.windowManager.getSettingsWindow();
    settingsWindow?.webContents.send('api-error', {
      message: e.message,
      code: e.code,
    });
  }

  /**
   * Handle server close
   */
  handleServerClose() {
    this.middleware.cleanup();
    console.log('UMBRA API v2 HTTP server closed');
  }

  /**
   * Broadcast donation event
   */
  broadcastDonation(donation) {
    return this.websocket.broadcastDonation(donation);
  }

  /**
   * Broadcast message event
   */
  broadcastMessage(message) {
    return this.websocket.broadcastMessage(message);
  }

  /**
   * Broadcast goal update event
   */
  broadcastGoalUpdate(goal) {
    return this.websocket.broadcastGoalUpdate(goal);
  }

  /**
   * Broadcast statistics update event
   */
  broadcastStatsUpdate(stats) {
    return this.websocket.broadcastStatsUpdate(stats);
  }

  /**
   * Broadcast settings update event
   */
  broadcastSettingsUpdate(settings) {
    return this.websocket.broadcastSettingsUpdate(settings);
  }

  /**
   * Get WebSocket client count
   */
  getWebSocketClientCount() {
    return this.websocket.getClientCount();
  }

  /**
   * Get donation history
   */
  getDonationHistory() {
    return this.router.donationHistory;
  }

  /**
   * Get message history
   */
  getMessageHistory() {
    return this.router.messageHistory;
  }

  /**
   * Add donation to history
   */
  addDonation(donation) {
    this.router.donationHistory.push(donation);
    if (this.router.donationHistory.length > this.router.maxHistorySize) {
      this.router.donationHistory.shift();
    }
  }

  /**
   * Add message to history
   */
  addMessage(message) {
    this.router.messageHistory.push(message);
    if (this.router.messageHistory.length > this.router.maxHistorySize) {
      this.router.messageHistory.shift();
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: !!this.httpServer,
      port: this.httpServer ? this.httpServer.address().port : null,
      clients: this.getWebSocketClientCount(),
      donations: this.getDonationHistory().length,
      messages: this.getMessageHistory().length,
      uptime: process.uptime()
    };
  }
}

module.exports = ApiServerV2;
