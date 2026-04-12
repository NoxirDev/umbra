// Chat UI module
(function() {
  'use strict';

  const { escapeHtml, safeColor, createElement } = window.UmbraUtils;

  const MAX_MESSAGES = 100;
  let messages = [];
  let blockedWords = [];
  let renderScheduled = false;

  const BADGE_MAP = {
    twitch: 'b-tw',
    youtube: 'b-yt',
    da: 'b-da',
    kick: 'b-kick',
    api: 'b-api',
    test: 'b-test',
  };

  const LABEL_MAP = {
    twitch: 'TW',
    youtube: 'YT',
    da: 'DA',
    kick: 'KICK',
    api: 'API',
    test: 'TEST',
  };

  function addMessage(platform, author, text, color, isDonation, amount) {
    const lower = text.toLowerCase();
    for (const word of blockedWords) {
      if (lower.includes(word)) return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Check for duplicate
    const last = messages[messages.length - 1];
    if (
      last &&
      last.author === author &&
      last.text === text &&
      last.platform === platform &&
      !last.isDonation &&
      !isDonation
    ) {
      last.count = (last.count || 1) + 1;
      last.time = time;
      scheduleRender();
      return;
    }

    messages.push({
      platform,
      author,
      text,
      color,
      isDonation,
      amount,
      time,
      count: 1,
    });

    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    scheduleRender();
  }

  /**
   * Add enhanced message with badges and emotes (Twitch)
   */
  function addEnhancedMessage(data) {
    const lower = data.text.toLowerCase();
    for (const word of blockedWords) {
      if (lower.includes(word)) return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    messages.push({
      platform: data.platform,
      author: data.author,
      text: data.text,
      color: data.color,
      badges: data.badges || [],
      emotes: data.emotes || [],
      bits: data.bits || 0,
      userId: data.userId,
      time,
      count: 1,
      enhanced: true,
    });

    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    scheduleRender();
  }

  /**
   * Schedule render using requestAnimationFrame for better performance
   */
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      render();
      renderScheduled = false;
    });
  }

  function render() {
    const list = document.getElementById('msgs');
    if (!list) return;

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    messages.forEach((m) => {
      const msg = createElement('div', 'msg ' + m.platform);

      const top = createElement('div', 'msg-top');

      // Platform badge
      const badgeClass = BADGE_MAP[m.platform] || 'b-api';
      const badgeLabel = LABEL_MAP[m.platform] || m.platform.toUpperCase();
      top.appendChild(createElement('span', 'badge ' + badgeClass, badgeLabel));

      // Twitch badges (if enhanced message)
      if (m.enhanced && m.badges && m.badges.length > 0) {
        m.badges.forEach((badge) => {
          const badgeInfo = window.TwitchEnhanced?.getBadgeInfo(badge.name, badge.version);
          if (badgeInfo) {
            if (badgeInfo.url) {
              // Use real Twitch badge image
              const badgeImg = document.createElement('img');
              badgeImg.className = 'twitch-badge-img';
              badgeImg.src = badgeInfo.url2x || badgeInfo.url;
              badgeImg.alt = badgeInfo.title || badgeInfo.name;
              badgeImg.title = badgeInfo.title || badgeInfo.name;
              badgeImg.loading = 'lazy';
              top.appendChild(badgeImg);
            } else {
              // Fallback to emoji
              const badgeEl = createElement('span', 'twitch-badge', badgeInfo.icon || '');
              badgeEl.title = badgeInfo.name;
              top.appendChild(badgeEl);
            }
          }
        });
      }

      // Author name
      const auth = createElement('span', 'msg-author', m.author);
      if (/^#[0-9a-fA-F]{6}$/.test(m.color)) {
        auth.style.color = safeColor(m.color);
      }
      top.appendChild(auth);

      if (m.count > 1) {
        top.appendChild(createElement('span', 'msg-time', 'x' + m.count));
      }
      top.appendChild(createElement('span', 'msg-time', m.time));

      msg.appendChild(top);

      // Message text with emotes
      const textEl = createElement('div', 'msg-text');
      if (m.enhanced && m.emotes && m.emotes.length > 0) {
        textEl.innerHTML = renderMessageWithEmotes(m.text, m.emotes);
      } else {
        textEl.textContent = m.count > 1 ? m.text + ' (x' + m.count + ')' : m.text;
      }

      // Add bits indicator if present
      if (m.bits && m.bits > 0) {
        const bitsEl = createElement('span', 'msg-bits', `${m.bits} bits`);
        textEl.appendChild(bitsEl);
      }

      msg.appendChild(textEl);
      fragment.appendChild(msg);
    });

    // Clear and append in one operation
    list.innerHTML = '';
    list.appendChild(fragment);
    list.scrollTop = list.scrollHeight;
  }

  /**
   * Render message text with emotes
   */
  function renderMessageWithEmotes(text, emotePositions) {
    // Sort emotes by position
    const sorted = emotePositions.sort((a, b) => a.start - b.start);

    let result = '';
    let lastIndex = 0;

    sorted.forEach((emote) => {
      // Add text before emote
      result += escapeHtml(text.slice(lastIndex, emote.start));

      // Add Twitch emote
      const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/2.0`;
      result += `<img class="emote" src="${emoteUrl}" alt="${text.slice(emote.start, emote.end + 1)}" loading="lazy">`;

      lastIndex = emote.end + 1;
    });

    // Add remaining text and check for third-party emotes
    const remainingText = text.slice(lastIndex);
    result += renderThirdPartyEmotes(remainingText);

    return result;
  }

  /**
   * Render third-party emotes (BTTV, FFZ, 7TV)
   */
  function renderThirdPartyEmotes(text) {
    if (!window.TwitchEnhanced) return escapeHtml(text);

    const words = text.split(' ');
    const result = words.map((word) => {
      const emote = window.TwitchEnhanced.getEmote(word);
      if (emote) {
        return `<img class="emote" src="${emote.url}" alt="${emote.code}" title="${emote.code} (${emote.provider})" loading="lazy">`;
      }
      return escapeHtml(word);
    });

    return result.join(' ');
  }

  function clearMessages() {
    messages = [];
    render();
  }

  function setBlockedWords(words) {
    blockedWords = words;
  }

  // Export to global
  window.ChatUI = {
    addMessage,
    addEnhancedMessage,
    clearMessages,
    setBlockedWords,
    render,
  };
})();
