// DonationAlerts service module
(function() {
  'use strict';

  const { getReconnectDelay } = window.UmbraUtils;

  let ws = null;
  let reconnecting = false;
  let attempt = 0;
  let token = '';
  let pingInterval = null;
  let authenticated = false;

  function connect(tokenParam) {
    if (!tokenParam) {
      disconnect();
      return;
    }

    token = tokenParam;
    disconnect();
    reconnecting = true;
    authenticated = false;

    ws = new WebSocket('wss://socket.donationalerts.ru:443/socket.io/?EIO=4&transport=websocket');

    ws.onopen = () => {
      attempt = 0;
    };

    ws.onmessage = (e) => {
      const data = e.data;

      if (data.startsWith('0') && !authenticated) {
        ws.send('40');
        return;
      }

      if ((data === '40' || data.startsWith('40{')) && !authenticated) {
        authenticated = true;
        ws.send('42["add-user",{"token":"' + token.trim() + '","type":"minor"}]');
        pingInterval = setInterval(() => {
          if (ws.readyState === 1) ws.send('3');
        }, 20000);
        return;
      }

      if (data === '2') {
        ws.send('3');
        return;
      }

      if (data.startsWith('42')) {
        try {
          const p = JSON.parse(data.slice(2));
          if (Array.isArray(p) && p[0] === 'donation') {
            const don = typeof p[1] === 'string' ? JSON.parse(p[1]) : p[1];
            const amt = don.amount + ' ' + don.currency;
            const author = don.username || 'anonymous';
            const message = don.message || '';

            window.ChatUI.addMessage('da', author, amt + (message ? ': ' + message : ''), '#a8a8b3', true, amt);

            // Handle donation
            if (window.OverlayApp && window.OverlayApp.handleDonation) {
              window.OverlayApp.handleDonation(don.amount, author, message, 'da');
            }
          }
        } catch (e) {
          console.error('[DA] parse error:', e);
        }
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      authenticated = false;
      if (reconnecting) {
        setTimeout(() => connect(token), getReconnectDelay(attempt++));
      }
    };
  }

  function disconnect() {
    reconnecting = false;
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    authenticated = false;
  }

  // Export to global
  window.DonationAlertsService = {
    connect,
    disconnect,
  };
})();
