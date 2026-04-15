// Kick service module
(function() {
  'use strict';

  const { getReconnectDelay, safeColor } = window.UmbraUtils;

  let ws = null;
  let reconnecting = false;
  let attempt = 0;
  let channel = '';
  let resolvedChatroomId = null;

  async function resolveChatroomId(channelName) {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channelName)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const chatroomId = data.chatroom?.id || data.chatroom_id;
      if (chatroomId) return String(chatroomId);
    } catch (e) {
      console.error('[Kick] Failed to resolve channel:', e);
    }
    return null;
  }

  async function connect(channelName) {
    if (!channelName) {
      disconnect();
      return;
    }

    channel = channelName;
    disconnect();
    reconnecting = true;

    resolvedChatroomId = await resolveChatroomId(channelName);
    if (!resolvedChatroomId) {
      console.error('[Kick] Could not resolve chatroom ID for:', channelName);
      return;
    }

    ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false');

    ws.onopen = () => {
      attempt = 0;
    };

    ws.onmessage = (e) => {
      let d;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!d) return;

      if (d.event === 'pusher:connection_established') {
        ws.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { auth: '', channel: 'chatrooms.' + resolvedChatroomId + '.v2' },
        }));
        return;
      }

      if (d.event === 'pusher:ping') {
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        return;
      }

      if (d.event === 'App\\Events\\ChatMessageEvent') {
        try {
          const msg = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
          const author = msg.sender?.username || 'anonymous';
          const text = msg.content || '';
          const color = msg.sender?.identity?.color || '#53fc18';
          window.ChatUI.addMessage('kick', author, text, safeColor(color), false, null);
        } catch {}
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (reconnecting) {
        setTimeout(() => connect(channel), getReconnectDelay(attempt++));
      }
    };
  }

  function disconnect() {
    reconnecting = false;
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    resolvedChatroomId = null;
  }

  window.KickService = {
    connect,
    disconnect,
  };
})();
