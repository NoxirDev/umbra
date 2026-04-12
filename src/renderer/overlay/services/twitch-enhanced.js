// Enhanced Twitch service with badges, emotes, and events
(function() {
  'use strict';

  const { getReconnectDelay, stringToColor } = window.UmbraUtils;

  let ws = null;
  let reconnecting = false;
  let attempt = 0;
  let channel = '';
  let channelId = null;

  // Emote caches
  let twitchEmotes = new Map();
  let bttvEmotes = new Map();
  let ffzEmotes = new Map();
  let seventvEmotes = new Map();

  // Badge cache
  let globalBadges = new Map();
  let channelBadges = new Map();

  /**
   * Connect to Twitch IRC with enhanced capabilities
   */
  async function connect(channelName) {
    if (!channelName) {
      disconnect();
      return;
    }

    channel = channelName;
    disconnect();
    reconnecting = true;

    // Load emotes and badges for this channel (async)
    loadEmotesAndBadges(channelName);

    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      attempt = 0;
      // Request tags, commands, and membership capabilities
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
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

        handleIRCMessage(line);
      });
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (reconnecting) {
        setTimeout(() => connect(channel), getReconnectDelay(attempt++));
      }
    };
  }

  /**
   * Parse IRC message with tags
   */
  function handleIRCMessage(line) {
    let tags = {};
    let rest = line;

    // Parse tags
    if (line.startsWith('@')) {
      const sp = line.indexOf(' ');
      line.slice(1, sp).split(';').forEach((t) => {
        const eq = t.indexOf('=');
        if (eq !== -1) {
          const key = t.slice(0, eq);
          const value = t.slice(eq + 1);
          tags[key] = value;
        }
      });
      rest = line.slice(sp + 1);
    }

    // Handle different message types
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

  /**
   * Handle chat message with badges and emotes
   */
  function handleChatMessage(message, tags) {
    const mm = message.match(/PRIVMSG #\S+ :(.+)/s);
    const nm = message.match(/:(\w+)!/);

    if (!mm || !nm) return;

    const author = tags['display-name'] || nm[1];
    const text = mm[1].trim();
    const color = tags['color'] || stringToColor(author);

    // Parse badges
    const badges = parseBadges(tags['badges']);

    // Parse emotes
    const emotePositions = parseEmotePositions(tags['emotes']);

    // Check if message contains bits
    const bits = tags['bits'] ? parseInt(tags['bits']) : 0;

    // Send to chat UI with enhanced data
    if (window.ChatUI && window.ChatUI.addEnhancedMessage) {
      window.ChatUI.addEnhancedMessage({
        platform: 'twitch',
        author,
        text,
        color,
        badges,
        emotes: emotePositions,
        bits,
        userId: tags['user-id'],
        timestamp: Date.now()
      });
    } else {
      // Fallback to basic message
      window.ChatUI.addMessage('twitch', author, text, color, false, null);
    }
  }

  /**
   * Handle user notices (subs, resubs, gifted subs, raids, etc.)
   */
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
      case 'ritual':
        handleRitual(tags);
        break;
    }
  }

  /**
   * Handle subscription event
   */
  function handleSubscription(tags) {
    const user = tags['display-name'] || tags['login'];
    const months = tags['msg-param-cumulative-months'] || '1';
    const tier = tags['msg-param-sub-plan'] || '1000';
    const message = tags['system-msg'] ? tags['system-msg'].replace(/\\s/g, ' ') : '';

    const tierName = {
      '1000': 'Tier 1',
      '2000': 'Tier 2',
      '3000': 'Tier 3',
      'Prime': 'Prime'
    }[tier] || 'Tier 1';

    if (window.DonationUI && window.DonationUI.showAlert) {
      window.DonationUI.showAlert({
        type: 'subscription',
        name: user,
        tier: tierName,
        months: parseInt(months),
        message: message,
        icon: '⭐'
      });
    }
  }

  /**
   * Handle gifted subscription
   */
  function handleGiftedSub(tags) {
    const gifter = tags['display-name'] || tags['login'];
    const recipient = tags['msg-param-recipient-display-name'] || tags['msg-param-recipient-user-name'];
    const tier = tags['msg-param-sub-plan'] || '1000';
    const months = tags['msg-param-months'] || '1';

    const tierName = {
      '1000': 'Tier 1',
      '2000': 'Tier 2',
      '3000': 'Tier 3'
    }[tier] || 'Tier 1';

    if (window.DonationUI && window.DonationUI.showAlert) {
      window.DonationUI.showAlert({
        type: 'gift_sub',
        name: gifter,
        recipient: recipient,
        tier: tierName,
        months: parseInt(months),
        icon: '🎁'
      });
    }
  }

  /**
   * Handle mystery gift (community gift)
   */
  function handleMysteryGift(tags) {
    const gifter = tags['display-name'] || tags['login'];
    const count = tags['msg-param-mass-gift-count'] || '1';
    const tier = tags['msg-param-sub-plan'] || '1000';

    const tierName = {
      '1000': 'Tier 1',
      '2000': 'Tier 2',
      '3000': 'Tier 3'
    }[tier] || 'Tier 1';

    if (window.DonationUI && window.DonationUI.showAlert) {
      window.DonationUI.showAlert({
        type: 'mystery_gift',
        name: gifter,
        count: parseInt(count),
        tier: tierName,
        icon: '🎉'
      });
    }
  }

  /**
   * Handle raid event
   */
  function handleRaid(tags) {
    const raider = tags['display-name'] || tags['login'];
    const viewers = tags['msg-param-viewerCount'] || '0';

    if (window.DonationUI && window.DonationUI.showAlert) {
      window.DonationUI.showAlert({
        type: 'raid',
        name: raider,
        viewers: parseInt(viewers),
        icon: '🚀'
      });
    }
  }

  /**
   * Handle ritual (new chatter)
   */
  function handleRitual(tags) {
    const user = tags['display-name'] || tags['login'];
    const ritualName = tags['msg-param-ritual-name'];

    if (ritualName === 'new_chatter') {
      // Optional: show welcome message
      console.log(`[Twitch] New chatter: ${user}`);
    }
  }

  /**
   * Handle message deletion
   */
  function handleClearMessage(message, tags) {
    const targetMsgId = tags['target-msg-id'];
    // TODO: implement message deletion in chat UI
    console.log('[Twitch] Message deleted:', targetMsgId);
  }

  /**
   * Handle chat clear or timeout
   */
  function handleClearChat(message, tags) {
    const targetUser = tags['target-user-id'];
    const duration = tags['ban-duration'];

    if (targetUser) {
      // User timeout or ban
      console.log(`[Twitch] User ${targetUser} ${duration ? 'timed out' : 'banned'}`);
    } else {
      // Chat cleared
      console.log('[Twitch] Chat cleared');
    }
  }

  /**
   * Parse badges from IRC tags
   */
  function parseBadges(badgeString) {
    if (!badgeString) return [];

    const badges = [];
    badgeString.split(',').forEach((badge) => {
      const [name, version] = badge.split('/');
      if (name) {
        badges.push({ name, version: version || '1' });
      }
    });

    console.log('[Twitch] Parsed badges:', badges);
    return badges;
  }

  /**
   * Parse emote positions from IRC tags
   */
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

  /**
   * Load emotes and badges (combined function)
   */
  async function loadEmotesAndBadges(channelName) {
    try {
      // Get channel ID first
      const channelData = await fetchChannelId(channelName);
      if (channelData) {
        channelId = channelData.id;

        // Load emotes and badges in parallel
        await Promise.all([
          loadBTTVEmotes(channelId),
          loadFFZEmotes(channelId),
          load7TVEmotes(channelId),
          loadBadges(channelId)
        ]);
      } else {
        // Load without channel ID (global only)
        await Promise.all([
          loadBTTVEmotes(null),
          loadFFZEmotes(null),
          load7TVEmotes(null),
          loadBadges(null)
        ]);
      }
    } catch (error) {
      console.error('[Twitch] Failed to load emotes and badges:', error);
    }
  }

  /**
   * Load emotes from various providers
   */
  async function loadEmotes(channelName) {
    try {
      // Get channel ID first
      const channelData = await fetchChannelId(channelName);
      if (channelData) {
        channelId = channelData.id;

        // Load emotes from all providers
        await Promise.all([
          loadBTTVEmotes(channelId),
          loadFFZEmotes(channelId),
          load7TVEmotes(channelId)
        ]);
      }
    } catch (error) {
      console.error('[Twitch] Failed to load emotes:', error);
    }
  }

  /**
   * Fetch channel ID from Twitch
   */
  async function fetchChannelId(channelName) {
    try {
      // Note: This requires Twitch API access
      // For now, we'll use third-party APIs
      const response = await fetch(`https://decapi.me/twitch/id/${channelName}`);
      const id = await response.text();

      if (id && !id.includes('error')) {
        return { id: id.trim() };
      }
    } catch (error) {
      console.error('[Twitch] Failed to fetch channel ID:', error);
    }
    return null;
  }

  /**
   * Load BTTV emotes
   */
  async function loadBTTVEmotes(channelId) {
    try {
      // Global BTTV emotes
      const globalRes = await fetch('https://api.betterttv.net/3/cached/emotes/global');
      const globalData = await globalRes.json();

      globalData.forEach((emote) => {
        bttvEmotes.set(emote.code, {
          id: emote.id,
          code: emote.code,
          url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
          provider: 'bttv'
        });
      });

      // Channel BTTV emotes
      if (channelId) {
        const channelRes = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);
        const channelData = await channelRes.json();

        if (channelData.channelEmotes) {
          channelData.channelEmotes.forEach((emote) => {
            bttvEmotes.set(emote.code, {
              id: emote.id,
              code: emote.code,
              url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
              provider: 'bttv'
            });
          });
        }

        if (channelData.sharedEmotes) {
          channelData.sharedEmotes.forEach((emote) => {
            bttvEmotes.set(emote.code, {
              id: emote.id,
              code: emote.code,
              url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
              provider: 'bttv'
            });
          });
        }
      }

      console.log(`[Twitch] Loaded ${bttvEmotes.size} BTTV emotes`);
    } catch (error) {
      console.error('[Twitch] Failed to load BTTV emotes:', error);
    }
  }

  /**
   * Load FFZ emotes
   */
  async function loadFFZEmotes(channelId) {
    try {
      // Global FFZ emotes
      const globalRes = await fetch('https://api.frankerfacez.com/v1/set/global');
      const globalData = await globalRes.json();

      if (globalData.sets) {
        Object.values(globalData.sets).forEach((set) => {
          if (set.emoticons) {
            set.emoticons.forEach((emote) => {
              const url = emote.urls['2'] || emote.urls['1'];
              ffzEmotes.set(emote.name, {
                id: emote.id,
                code: emote.name,
                url: `https:${url}`,
                provider: 'ffz'
              });
            });
          }
        });
      }

      // Channel FFZ emotes
      if (channelId) {
        const channelRes = await fetch(`https://api.frankerfacez.com/v1/room/id/${channelId}`);
        const channelData = await channelRes.json();

        if (channelData.sets) {
          Object.values(channelData.sets).forEach((set) => {
            if (set.emoticons) {
              set.emoticons.forEach((emote) => {
                const url = emote.urls['2'] || emote.urls['1'];
                ffzEmotes.set(emote.name, {
                  id: emote.id,
                  code: emote.name,
                  url: `https:${url}`,
                  provider: 'ffz'
                });
              });
            }
          });
        }
      }

      console.log(`[Twitch] Loaded ${ffzEmotes.size} FFZ emotes`);
    } catch (error) {
      console.error('[Twitch] Failed to load FFZ emotes:', error);
    }
  }

  /**
   * Load 7TV emotes
   */
  async function load7TVEmotes(channelId) {
    try {
      // Global 7TV emotes
      const globalRes = await fetch('https://7tv.io/v3/emote-sets/global');
      const globalData = await globalRes.json();

      if (globalData.emotes) {
        globalData.emotes.forEach((emote) => {
          const url = emote.data?.host?.url;
          if (url) {
            seventvEmotes.set(emote.name, {
              id: emote.id,
              code: emote.name,
              url: `https:${url}/2x.webp`,
              provider: '7tv'
            });
          }
        });
      }

      // Channel 7TV emotes
      if (channelId) {
        const channelRes = await fetch(`https://7tv.io/v3/users/twitch/${channelId}`);
        const channelData = await channelRes.json();

        if (channelData.emote_set?.emotes) {
          channelData.emote_set.emotes.forEach((emote) => {
            const url = emote.data?.host?.url;
            if (url) {
              seventvEmotes.set(emote.name, {
                id: emote.id,
                code: emote.name,
                url: `https:${url}/2x.webp`,
                provider: '7tv'
              });
            }
          });
        }
      }

      console.log(`[Twitch] Loaded ${seventvEmotes.size} 7TV emotes`);
    } catch (error) {
      console.error('[Twitch] Failed to load 7TV emotes:', error);
    }
  }

  /**
   * Load badges from Twitch
   */
  async function loadBadges(channelId) {
    try {
      // Load global badges
      const globalRes = await fetch('https://badges.twitch.tv/v1/badges/global/display');
      const globalData = await globalRes.json();

      if (globalData.badge_sets) {
        Object.entries(globalData.badge_sets).forEach(([setId, badgeSet]) => {
          Object.entries(badgeSet.versions).forEach(([version, versionData]) => {
            // Store with version key: "moderator/1"
            const key = `${setId}/${version}`;
            globalBadges.set(key, {
              name: setId,
              version: version,
              url: versionData.image_url_1x,
              url2x: versionData.image_url_2x,
              url4x: versionData.image_url_4x,
              title: versionData.title,
              description: versionData.description
            });
          });
        });
      }

      console.log(`[Twitch] Loaded ${globalBadges.size} global badge versions`);

      // Load channel badges if we have channel ID
      if (channelId) {
        try {
          const channelRes = await fetch(`https://badges.twitch.tv/v1/badges/channels/${channelId}/display`);
          const channelData = await channelRes.json();

          if (channelData.badge_sets) {
            Object.entries(channelData.badge_sets).forEach(([setId, badgeSet]) => {
              Object.entries(badgeSet.versions).forEach(([version, versionData]) => {
                // Store with version key: "subscriber/12"
                const key = `${setId}/${version}`;
                channelBadges.set(key, {
                  name: setId,
                  version: version,
                  url: versionData.image_url_1x,
                  url2x: versionData.image_url_2x,
                  url4x: versionData.image_url_4x,
                  title: versionData.title,
                  description: versionData.description
                });
              });
            });
          }
          console.log(`[Twitch] Loaded ${channelBadges.size} channel badge versions`);
        } catch (err) {
          console.warn('[Twitch] Could not load channel badges:', err.message);
        }
      }
    } catch (error) {
      console.error('[Twitch] Failed to load badges:', error);
    }
  }

  /**
   * Get badge info
   */
  function getBadgeInfo(badgeName, badgeVersion) {
    // Try with version first: "moderator/1"
    const keyWithVersion = `${badgeName}/${badgeVersion}`;
    let badge = globalBadges.get(keyWithVersion) || channelBadges.get(keyWithVersion);

    // Fallback: try just the name for version "1"
    if (!badge && badgeVersion !== '1') {
      const keyDefault = `${badgeName}/1`;
      badge = globalBadges.get(keyDefault) || channelBadges.get(keyDefault);
    }

    console.log(`[Twitch] getBadgeInfo('${badgeName}', '${badgeVersion}'):`, badge ? 'found' : 'not found');
    return badge;
  }

  /**
   * Get emote by code
   */
  function getEmote(code) {
    return bttvEmotes.get(code) || ffzEmotes.get(code) || seventvEmotes.get(code);
  }

  /**
   * Get all emotes
   */
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

  // Export to global
  window.TwitchEnhanced = {
    connect,
    disconnect,
    getBadgeInfo,
    getEmote,
    getAllEmotes,
  };
})();
