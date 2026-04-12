// UMBRA - Centralized logging system
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = this.logLevels.INFO;
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 5;
    
    // Ensure log directory exists
    this.ensureLogDirectory();
    
    // Current log file
    this.currentLogFile = this.getLogFilePath();
    
    // Log rotation check
    this.checkLogRotation();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create log directory:', err.message);
    }
  }

  /**
   * Get current log file path
   */
  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `umbra-${date}.log`);
  }

  /**
   * Check and perform log rotation if needed
   */
  checkLogRotation() {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size > this.maxFileSize) {
          this.rotateLogs();
        }
      }
    } catch (err) {
      // Ignore rotation errors
    }
  }

  /**
   * Rotate log files
   */
  rotateLogs() {
    try {
      // Get all log files
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('umbra-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Newest first

      // Remove oldest files if we have too many
      if (files.length >= this.maxFiles) {
        for (let i = this.maxFiles - 1; i < files.length; i++) {
          fs.unlinkSync(files[i].path);
        }
      }

      // Create new log file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.logDir, `umbra-${timestamp}.log`);
    } catch (err) {
      console.error('Log rotation failed:', err.message);
    }
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (typeof level === 'string') {
      const upperLevel = level.toUpperCase();
      if (this.logLevels[upperLevel] !== undefined) {
        this.currentLevel = this.logLevels[upperLevel];
      }
    } else if (typeof level === 'number') {
      this.currentLevel = Math.max(0, Math.min(3, level));
    }
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const levelStr = level.padEnd(5);
    
    let formatted = `[${timestamp}] [${pid}] [${levelStr}] ${message}`;
    
    // Add meta data if present
    if (Object.keys(meta).length > 0) {
      try {
        formatted += ` ${JSON.stringify(meta)}`;
      } catch (err) {
        formatted += ` [Meta serialization error: ${err.message}]`;
      }
    }
    
    return formatted;
  }

  /**
   * Write log to file
   */
  writeToFile(message) {
    try {
      fs.appendFileSync(this.currentLogFile, message + '\n', 'utf8');
    } catch (err) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', err.message);
    }
  }

  /**
   * Log error
   */
  error(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.ERROR) {
      const formatted = this.formatMessage('ERROR', message, meta);
      console.error(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log warning
   */
  warn(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.WARN) {
      const formatted = this.formatMessage('WARN', message, meta);
      console.warn(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log info
   */
  info(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.INFO) {
      const formatted = this.formatMessage('INFO', message, meta);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log debug
   */
  debug(message, meta = {}) {
    if (this.currentLevel >= this.logLevels.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message, meta);
      console.debug(formatted);
      this.writeToFile(formatted);
    }
  }

  /**
   * Log API request
   */
  logRequest(method, url, ip, statusCode, userAgent = '') {
    this.info('API Request', {
      method,
      url,
      ip,
      statusCode,
      userAgent: userAgent.substring(0, 100)
    });
  }

  /**
   * Log API error
   */
  logApiError(method, url, ip, error, statusCode = 500) {
    this.error('API Error', {
      method,
      url,
      ip,
      error: error.message || String(error),
      statusCode
    });
  }

  /**
   * Log WebSocket event
   */
  logWebSocket(event, clientCount, details = {}) {
    this.info('WebSocket Event', {
      event,
      clientCount,
      ...details
    });
  }

  /**
   * Log donation
   */
  logDonation(donation) {
    this.info('Donation Received', {
      id: donation.id,
      name: donation.name,
      amount: donation.amount,
      currency: donation.currency,
      source: donation.source
    });
  }

  /**
   * Log settings change
   */
  logSettingsChange(key, oldValue, newValue) {
    this.info('Settings Changed', {
      key,
      oldValue: this.sanitizeForLog(key, oldValue),
      newValue: this.sanitizeForLog(key, newValue)
    });
  }

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLog(key, value) {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'apiKey', 'oauth'];
    
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      if (typeof value === 'string' && value.length > 0) {
        return '***' + value.substring(value.length - 4);
      }
      return '***';
    }
    
    return value;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 100) {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        const content = fs.readFileSync(this.currentLogFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.slice(-limit);
      }
    } catch (err) {
      this.error('Failed to read log file', { error: err.message });
    }
    
    return [];
  }

  /**
   * Get log file list
   */
  getLogFiles() {
    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('umbra-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          size: fs.statSync(path.join(this.logDir, f)).size,
          modified: fs.statSync(path.join(this.logDir, f)).mtime
        }))
        .sort((a, b) => b.modified - a.modified);
    } catch (err) {
      return [];
    }
  }

  /**
   * Clear old logs
   */
  clearOldLogs(daysToKeep = 7) {
    try {
      const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const files = this.getLogFiles();
      
      let deleted = 0;
      files.forEach(file => {
        if (file.modified.getTime() < cutoff) {
          fs.unlinkSync(file.path);
          deleted++;
        }
      });
      
      if (deleted > 0) {
        this.info(`Cleared ${deleted} old log files`);
      }
      
      return deleted;
    } catch (err) {
      this.error('Failed to clear old logs', { error: err.message });
      return 0;
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;