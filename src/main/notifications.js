// Desktop notifications module
const { Notification } = require('electron');
const path = require('path');

class NotificationManager {
  constructor(iconPath) {
    this.iconPath = iconPath;
    this.enabled = true;
    this.settings = {
      donations: true,
      goals: true,
      milestones: true,
      minDonationAmount: 0, // Notify for all donations by default
    };
  }

  /**
   * Update notification settings
   */
  updateSettings(settings) {
    if (settings.notifyDonations !== undefined) {
      this.settings.donations = settings.notifyDonations;
    }
    if (settings.notifyGoals !== undefined) {
      this.settings.goals = settings.notifyGoals;
    }
    if (settings.notifyMilestones !== undefined) {
      this.settings.milestones = settings.notifyMilestones;
    }
    if (settings.minDonationAmount !== undefined) {
      this.settings.minDonationAmount = parseFloat(settings.minDonationAmount) || 0;
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return Notification.isSupported();
  }

  /**
   * Show donation notification
   */
  notifyDonation(donation) {
    if (!this.enabled || !this.settings.donations) return;

    const amount = parseFloat(donation.amount) || 0;
    if (amount < this.settings.minDonationAmount) return;

    const notification = new Notification({
      title: `💰 Новый донат: ${donation.amount} ${donation.currency || 'RUB'}`,
      body: `${donation.name}: ${donation.message || 'Без сообщения'}`,
      icon: this.iconPath,
      silent: false,
      urgency: amount >= 1000 ? 'critical' : 'normal',
    });

    notification.show();

    notification.on('click', () => {
      // Focus overlay window when notification is clicked
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      const overlay = windows.find(w => w.getTitle() === 'UMBRA');
      if (overlay) {
        overlay.show();
        overlay.focus();
      }
    });
  }

  /**
   * Show goal reached notification
   */
  notifyGoalReached(goal) {
    if (!this.enabled || !this.settings.goals) return;

    const notification = new Notification({
      title: '🎯 Цель достигнута!',
      body: `${goal.title}: ${goal.current} / ${goal.target}`,
      icon: this.iconPath,
      silent: false,
      urgency: 'critical',
    });

    notification.show();
  }

  /**
   * Show milestone notification
   */
  notifyMilestone(milestone) {
    if (!this.enabled || !this.settings.milestones) return;

    const notification = new Notification({
      title: `🎉 Веха достигнута!`,
      body: milestone.message,
      icon: this.iconPath,
      silent: false,
      urgency: 'normal',
    });

    notification.show();
  }

  /**
   * Show custom notification
   */
  notify(title, body, options = {}) {
    if (!this.enabled) return;

    const notification = new Notification({
      title,
      body,
      icon: this.iconPath,
      silent: options.silent || false,
      urgency: options.urgency || 'normal',
      ...options,
    });

    notification.show();
  }

  /**
   * Show error notification
   */
  notifyError(message) {
    if (!this.enabled) return;

    const notification = new Notification({
      title: '⚠️ UMBRA - Ошибка',
      body: message,
      icon: this.iconPath,
      silent: false,
      urgency: 'critical',
    });

    notification.show();
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = NotificationManager;
