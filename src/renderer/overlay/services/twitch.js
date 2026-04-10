// Twitch service module
(function() {
  'use strict';

  const { getReconnectDelay, stringToColor } = window.UmbraUtils;

  let ws = null;
  let reconnecting = false;
  let attempt = 0;
  let channel = '';

  function connect(channelName) {
    if (!channelName) {
      disconnect();
      return;
    }

    channel = channelName;
    disconnect();
    reconnecting = true;

    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      attempt = 0;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS oauth:justinfan' + Math.floor(Math.random() * 99999));
      ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
      ws.send('JOIN #' + channel.toLowerCase());
    };

    ws.onmessage = (e) => {
      e.data.split('\r\n').forEach((line) => {
        if (!line) return;

        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          return;
        }

        let tags = {};
        let rest = line;

        if (line.startsWith('@')) {
          const sp = line.indexOf(' ');
          line.slice(1, sp).split(';').forEach((t) => {
            const eq = t.indexOf('=');
            if (eq !== -1) tags[t.slice(0, eq)] = t.slice(eq + 1);
          });
          rest = line.slice(sp + 1);
        }

        if (rest.includes('PRIVMSG')) {
          const mm = rest.match(/PRIVMSG #\S+ :(.+)/s);
          const nm = rest.match(/:(\w+)!/);
          if (mm && nm) {
            const author = tags['display-name'] || nm[1];
            const text = mm[1].trim();
            const color = tags['color'] || stringToColor(author);
            window.ChatUI.addMessage('twitch', author, text, color, false, null);
          }
        }
      });
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
  }

  // Export to global
  window.TwitchService = {
    connect,
    disconnect,
  };
})();
