// Statistics module for UMBRA
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const CONSTANTS = require('../shared/constants');

class StatisticsManager {
  constructor() {
    this.statsPath = path.join(app.getPath('userData'), 'statistics.json');
    this.stats = this.load();
    this.sessionStart = Date.now();
    this._saveTimer = null;
    this._dirty = false;
  }

  /**
   * Load statistics from disk
   */
  load() {
    try {
      if (fs.existsSync(this.statsPath)) {
        const data = fs.readFileSync(this.statsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[Statistics] Failed to load:', error.message);
    }
    return this.getDefaults();
  }

  /**
   * Save statistics to disk
   */
  save() {
    try {
      const data = JSON.stringify(this.stats, null, 2);
      const tempPath = this.statsPath + '.tmp';
      fs.writeFileSync(tempPath, data, 'utf8');
      fs.renameSync(tempPath, this.statsPath);
      return true;
    } catch (error) {
      console.error('[Statistics] Failed to save:', error.message);
      return false;
    }
  }

  _scheduleSave() {
    this._dirty = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._dirty) {
        this._dirty = false;
        this.save();
      }
    }, 5000);
  }

  _flushSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._dirty) {
      this._dirty = false;
      this.save();
    }
  }

  getDefaults() {
    return {
      allTime: {
        totalDonations: 0,
        totalAmount: 0,
        totalMessages: 0,
        topDonators: [], // { name, amount, count, lastDonation }
        firstDonation: null,
        lastDonation: null,
      },
      sessions: [], // Last 30 sessions
    };
  }

  /**
   * Record a donation
   */
  recordDonation(donation) {
    const amount = parseFloat(donation.amount) || 0;
    const name = donation.name || 'Anonymous';

    // Update all-time stats
    this.stats.allTime.totalDonations++;
    this.stats.allTime.totalAmount += amount;
    this.stats.allTime.lastDonation = {
      name,
      amount,
      timestamp: donation.timestamp || new Date().toISOString(),
    };

    if (!this.stats.allTime.firstDonation) {
      this.stats.allTime.firstDonation = this.stats.allTime.lastDonation;
    }

    // Update top donators
    this.updateTopDonators(name, amount, donation.timestamp);

    this._scheduleSave();
  }

  recordMessage() {
    this.stats.allTime.totalMessages++;
    this._scheduleSave();
  }

  /**
   * Update top donators list
   */
  updateTopDonators(name, amount, timestamp) {
    let donator = this.stats.allTime.topDonators.find(d => d.name === name);

    if (donator) {
      donator.amount += amount;
      donator.count++;
      donator.lastDonation = timestamp;
    } else {
      donator = {
        name,
        amount,
        count: 1,
        firstDonation: timestamp,
        lastDonation: timestamp,
      };
      this.stats.allTime.topDonators.push(donator);
    }

    // Sort by amount (descending) and keep top 100
    this.stats.allTime.topDonators.sort((a, b) => b.amount - a.amount);
    if (this.stats.allTime.topDonators.length > 100) {
      this.stats.allTime.topDonators = this.stats.allTime.topDonators.slice(0, 100);
    }
  }

  /**
   * Get top donators
   */
  getTopDonators(limit = 10) {
    return this.stats.allTime.topDonators.slice(0, limit);
  }

  /**
   * Get all-time statistics
   */
  getAllTimeStats() {
    return {
      ...this.stats.allTime,
      averageDonation: this.stats.allTime.totalDonations > 0
        ? (this.stats.allTime.totalAmount / this.stats.allTime.totalDonations).toFixed(2)
        : 0,
    };
  }

  getStats() {
    const allTime = this.getAllTimeStats();
    const session = {
      total_donations: allTime.totalDonations,
      total_amount: allTime.totalAmount,
      total_messages: allTime.totalMessages,
      average_donation: allTime.averageDonation,
    };
    return {
      allTime,
      session,
      history: {
        donations: this.donationHistory?.length || 0,
        messages: this.messageHistory?.length || 0,
      },
      topDonators: this.getTopDonators(10),
      recentSessions: this.getRecentSessions(5),
    };
  }

  /**
   * Start new session
   */
  startSession() {
    this.sessionStart = Date.now();
  }

  /**
   * End current session and save
   */
  endSession(sessionData) {
    const session = {
      start: this.sessionStart,
      end: Date.now(),
      duration: Date.now() - this.sessionStart,
      donations: sessionData.donations || 0,
      amount: sessionData.amount || 0,
      messages: sessionData.messages || 0,
    };

    this.stats.sessions.unshift(session);

    // Keep only last 30 sessions
    if (this.stats.sessions.length > 30) {
      this.stats.sessions = this.stats.sessions.slice(0, 30);
    }

    this.save();
    return session;
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit = 10) {
    return this.stats.sessions.slice(0, limit);
  }

  reset() {
    this.stats = this.getDefaults();
    this.save();
  }

  /**
   * Export statistics to JSON
   */
  export() {
    return {
      ...this.stats,
      exportDate: new Date().toISOString(),
      version: CONSTANTS.APP_VERSION,
    };
  }

  /**
   * Import statistics from JSON
   */
  import(data) {
    try {
      if (data.allTime) {
        const a = data.allTime;
        this.stats.allTime = {
          totalDonations: Math.max(0, parseInt(a.totalDonations) || 0),
          totalAmount: Math.max(0, parseFloat(a.totalAmount) || 0),
          totalMessages: Math.max(0, parseInt(a.totalMessages) || 0),
          topDonators: Array.isArray(a.topDonators)
            ? a.topDonators.slice(0, 100).map(d => ({
                name: String(d.name || '').slice(0, 50),
                amount: Math.max(0, parseFloat(d.amount) || 0),
                count: Math.max(0, parseInt(d.count) || 0),
                lastDonation: d.lastDonation || null,
              }))
            : [],
          firstDonation: a.firstDonation || null,
          lastDonation: a.lastDonation || null,
        };
      }
      if (data.sessions) {
        this.stats.sessions = Array.isArray(data.sessions)
          ? data.sessions.slice(0, 30).map(s => ({
              start: parseInt(s.start) || 0,
              end: parseInt(s.end) || 0,
              duration: Math.max(0, parseInt(s.duration) || 0),
              donations: Math.max(0, parseInt(s.donations) || 0),
              amount: Math.max(0, parseFloat(s.amount) || 0),
              messages: Math.max(0, parseInt(s.messages) || 0),
            }))
          : [];
      }
      this.save();
      return true;
    } catch (error) {
      console.error('[Statistics] Import failed:', error.message);
      return false;
    }
  }

  /**
   * Cleanup resources (stop timers)
   */
  cleanup() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._flushSave();
  }
}

module.exports = StatisticsManager;
