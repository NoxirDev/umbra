// Twitch service module — unified (basic + enhanced)
(function() {
  'use strict';

  const { getReconnectDelay, stringToColor } = window.UmbraUtils;

  let ws = null;
  let reconnecting = false;
  let attempt = 0;
  let channel = '';
  let channelId = null;
  let enhanced = false;

  let bttvEmotes = new Map();
  let ffzEmotes = new Map();
  let seventvEmotes = new Map();
  let globalBadges = new Map();
  let channelBadges = new Map();

  async function connect(channelName) {
    if (!channelName) {
      disconnect();
      return;
    }

    channel = channelName;
    disconnect();
    reconnecting = true;

    if (window.ChatUI && window.ChatUI.addEnhancedMessage) {
      enhanced = true;
      loadEmotesAndBadges(channelName);
    }

    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      attempt = 0;
      const caps = enhanced
        ? 'CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership'
        : 'CAP REQ :twitch.tv/tags twitch.tv/commands';
      ws.send(caps);
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

        if (enhanced) {
          handleIRCMessage(line);
        } else {
          handleBasicMessage(line);
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

  function handleBasicMessage(line) {
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
  }

  function handleIRCMessage(line) {
    let tags = {};
    let rest = line;

    if (line.startsWith('@')) {
      const sp = line.indexOf(' ');
      line.slice(1, sp).split(';').forEach((t) => {
        const eq = t.indexOf('=');
        if (eq !== -1) {
          tags[t.slice(0, eq)] = t.slice(eq + 1);
        }
      });
      rest = line.slice(sp + 1);
    }

    if (rest.includes('PRIVMSG')) {
      handleChatMessage(rest, tags);
    } else if (rest.includes('USERNOTICE')) {
      handleUserNotice(rest, tags);
    } else if (rest.includes('CLEARMSG')) {
      handleClearMessage(rest, tags);
    } else if (rest.includes('CLEARCHAT')) {
      handleClearChat(rest, tags);
    }
  }

  function handleChatMessage(message, tags) {
    const mm = message.match(/PRIVMSG #\S+ :(.+)/s);
    const nm = message.match(/:(\w+)!/);
    if (!mm || !nm) return;

    const author = tags['display-name'] || nm[1];
    const text = mm[1].trim();
    const color = tags['color'] || stringToColor(author);
    const badges = parseBadges(tags['badges']);
    const emotePositions = parseEmotePositions(tags['emotes']);
    const bits = tags['bits'] ? parseInt(tags['bits']) : 0;

    window.ChatUI.addEnhancedMessage({
      platform: 'twitch',
      author,
      text,
      color,
      badges,
      emotes: emotePositions,
      bits,
      userId: tags['user-id'],
      msgId: tags['id'],
      timestamp: Date.now()
    });
  }

  function handleUserNotice(message, tags) {
    const msgId = tags['msg-id'];
    switch (msgId) {
      case 'sub':
      case 'resub':
        handleSubscription(tags);
        break;
      case 'subgift':
      case 'anonsubgift':
        handleGiftedSub(tags);
        break;
      case 'submysterygift':
        handleMysteryGift(tags);
        break;
      case 'raid':
        handleRaid(tags);
        break;
    }
  }

  function handleSubscription(tags) {
    const user = tags['display-name'] || tags['login'];
    const months = tags['msg-param-cumulative-months'] || '1';
    const tier = tags['msg-param-sub-plan'] || '1000';
    const message = tags['system-msg'] ? tags['system-msg'].replace(/\\s/g, ' ') : '';
    const tierName = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3', 'Prime': 'Prime' }[tier] || 'Tier 1';

    window.DonationsUI?.showAlert({
      type: 'subscription', name: user, tier: tierName, months: parseInt(months), message, icon: '⭐'
    });
  }

  function handleGiftedSub(tags) {
    const gifter = tags['display-name'] || tags['login'];
    const recipient = tags['msg-param-recipient-display-name'] || tags['msg-param-recipient-user-name'];
    const tier = tags['msg-param-sub-plan'] || '1000';
    const tierName = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3' }[tier] || 'Tier 1';

    window.DonationsUI?.showAlert({
      type: 'gift_sub', name: gifter, recipient, tier: tierName, icon: '🎁'
    });
  }

  function handleMysteryGift(tags) {
    const gifter = tags['display-name'] || tags['login'];
    const count = tags['msg-param-mass-gift-count'] || '1';
    const tier = tags['msg-param-sub-plan'] || '1000';
    const tierName = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3' }[tier] || 'Tier 1';

    window.DonationsUI?.showAlert({
      type: 'mystery_gift', name: gifter, count: parseInt(count), tier: tierName, icon: '🎉'
    });
  }

  function handleRaid(tags) {
    const raider = tags['display-name'] || tags['login'];
    const viewers = tags['msg-param-viewerCount'] || '0';

    window.DonationsUI?.showAlert({
      type: 'raid', name: raider, viewers: parseInt(viewers), icon: '🚀'
    });
  }

  function handleClearMessage(message, tags) {
    const targetMsgId = tags['target-msg-id'];
    if (targetMsgId && window.ChatUI && window.ChatUI.deleteMessage) {
      window.ChatUI.deleteMessage(targetMsgId);
    }
  }

  function handleClearChat(message, tags) {
    const targetUser = tags['target-user-id'];
    if (targetUser && window.ChatUI && window.ChatUI.deleteMessagesByUser) {
      window.ChatUI.deleteMessagesByUser(targetUser);
    } else if (!targetUser && window.ChatUI) {
      window.ChatUI.clearMessages();
    }
  }

  function parseBadges(badgeString) {
    if (!badgeString) return [];
    const badges = [];
    badgeString.split(',').forEach((badge) => {
      const [name, version] = badge.split('/');
      if (name) badges.push({ name, version: version || '1' });
    });
    return badges;
  }

  function parseEmotePositions(emoteString) {
    if (!emoteString) return [];
    const emotes = [];
    emoteString.split('/').forEach((emote) => {
      const [id, positions] = emote.split(':');
      if (positions) {
        positions.split(',').forEach((pos) => {
          const [start, end] = pos.split('-').map(Number);
          emotes.push({ id, start, end });
        });
      }
    });
    return emotes;
  }

  async function loadEmotesAndBadges(channelName) {
    try {
      const channelData = await fetchChannelId(channelName);
      channelId = channelData?.id || null;
      await Promise.all([
        loadBTTVEmotes(channelId),
        loadFFZEmotes(channelId),
        load7TVEmotes(channelId),
        loadBadges(channelId)
      ]);
    } catch (error) {
      console.error('[Twitch] Failed to load emotes and badges:', error);
    }
  }

  async function fetchChannelId(channelName) {
    try {
      const response = await fetch(`https://decapi.me/twitch/id/${channelName}`);
      const id = await response.text();
      if (id && !id.includes('error')) return { id: id.trim() };
    } catch (error) {
      console.error('[Twitch] Failed to fetch channel ID:', error);
    }
    return null;
  }

  async function loadBTTVEmotes(cid) {
    try {
      const globalRes = await fetch('https://api.betterttv.net/3/cached/emotes/global');
      const globalData = await globalRes.json();
      globalData.forEach((emote) => {
        bttvEmotes.set(emote.code, {
          id: emote.id, code: emote.code,
          url: `https://cdn.betterttv.net/emote/${emote.id}/2x`, provider: 'bttv'
        });
      });
      if (cid) {
        const channelRes = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${cid}`);
        const channelData = await channelRes.json();
        [...(channelData.channelEmotes || []), ...(channelData.sharedEmotes || [])].forEach((emote) => {
          bttvEmotes.set(emote.code, {
            id: emote.id, code: emote.code,
            url: `https://cdn.betterttv.net/emote/${emote.id}/2x`, provider: 'bttv'
          });
        });
      }
    } catch (error) {
      console.error('[Twitch] Failed to load BTTV emotes:', error);
    }
  }

  async function loadFFZEmotes(cid) {
    try {
      const globalRes = await fetch('https://api.frankerfacez.com/v1/set/global');
      const globalData = await globalRes.json();
      if (globalData.sets) {
        Object.values(globalData.sets).forEach((set) => {
          set.emoticons?.forEach((emote) => {
            const url = emote.urls['2'] || emote.urls['1'];
            ffzEmotes.set(emote.name, {
              id: emote.id, code: emote.name, url: `https:${url}`, provider: 'ffz'
            });
          });
        });
      }
      if (cid) {
        const channelRes = await fetch(`https://api.frankerfacez.com/v1/room/id/${cid}`);
        const channelData = await channelRes.json();
        if (channelData.sets) {
          Object.values(channelData.sets).forEach((set) => {
            set.emoticons?.forEach((emote) => {
              const url = emote.urls['2'] || emote.urls['1'];
              ffzEmotes.set(emote.name, {
                id: emote.id, code: emote.name, url: `https:${url}`, provider: 'ffz'
              });
            });
          });
        }
      }
    } catch (error) {
      console.error('[Twitch] Failed to load FFZ emotes:', error);
    }
  }

  async function load7TVEmotes(cid) {
    try {
      const globalRes = await fetch('https://7tv.io/v3/emote-sets/global');
      const globalData = await globalRes.json();
      globalData.emotes?.forEach((emote) => {
        const url = emote.data?.host?.url;
        if (url) {
          seventvEmotes.set(emote.name, {
            id: emote.id, code: emote.name, url: `https:${url}/2x.webp`, provider: '7tv'
          });
        }
      });
      if (cid) {
        const channelRes = await fetch(`https://7tv.io/v3/users/twitch/${cid}`);
        const channelData = await channelRes.json();
        channelData.emote_set?.emotes?.forEach((emote) => {
          const url = emote.data?.host?.url;
          if (url) {
            seventvEmotes.set(emote.name, {
              id: emote.id, code: emote.name, url: `https:${url}/2x.webp`, provider: '7tv'
            });
          }
        });
      }
    } catch (error) {
      console.error('[Twitch] Failed to load 7TV emotes:', error);
    }
  }

  async function loadBadges(cid) {
    try {
      const globalRes = await fetch('https://badges.twitch.tv/v1/badges/global/display');
      const globalData = await globalRes.json();
      if (globalData.badge_sets) {
        Object.entries(globalData.badge_sets).forEach(([setId, badgeSet]) => {
          Object.entries(badgeSet.versions).forEach(([version, v]) => {
            globalBadges.set(`${setId}/${version}`, {
              name: setId, version, url: v.image_url_1x,
              url2x: v.image_url_2x, url4x: v.image_url_4x,
              title: v.title, description: v.description
            });
          });
        });
      }
      if (cid) {
        try {
          const channelRes = await fetch(`https://badges.twitch.tv/v1/badges/channels/${cid}/display`);
          const channelData = await channelRes.json();
          if (channelData.badge_sets) {
            Object.entries(channelData.badge_sets).forEach(([setId, badgeSet]) => {
              Object.entries(badgeSet.versions).forEach(([version, v]) => {
                channelBadges.set(`${setId}/${version}`, {
                  name: setId, version, url: v.image_url_1x,
                  url2x: v.image_url_2x, url4x: v.image_url_4x,
                  title: v.title, description: v.description
                });
              });
            });
          }
        } catch {}
      }
    } catch (error) {
      console.error('[Twitch] Failed to load badges:', error);
    }
  }

  function getBadgeInfo(badgeName, badgeVersion) {
    const key = `${badgeName}/${badgeVersion}`;
    let badge = globalBadges.get(key) || channelBadges.get(key);
    if (!badge && badgeVersion !== '1') {
      badge = globalBadges.get(`${badgeName}/1`) || channelBadges.get(`${badgeName}/1`);
    }
    return badge;
  }

  function getEmote(code) {
    return bttvEmotes.get(code) || ffzEmotes.get(code) || seventvEmotes.get(code);
  }

  function getAllEmotes() {
    return {
      bttv: Array.from(bttvEmotes.values()),
      ffz: Array.from(ffzEmotes.values()),
      '7tv': Array.from(seventvEmotes.values())
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

  window.TwitchService = { connect, disconnect, getBadgeInfo, getEmote, getAllEmotes };
  window.TwitchEnhanced = window.TwitchService;
})();
