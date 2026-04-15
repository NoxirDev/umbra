// Chat UI module
(function() {
  'use strict';

  const { escapeHtml, safeColor, createElement, isSafeUrl } = window.UmbraUtils;

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
      msgId: data.msgId,
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
  let lastRenderedCount = 0;

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

    if (lastRenderedCount > messages.length || lastRenderedCount === 0) {
      list.innerHTML = '';
      lastRenderedCount = 0;
    }

    while (list.childNodes.length > messages.length) {
      list.removeChild(list.firstChild);
      lastRenderedCount--;
    }

    const fragment = document.createDocumentFragment();

    for (let i = lastRenderedCount; i < messages.length; i++) {
      const m = messages[i];
      const msg = createElement('div', 'msg ' + m.platform);

      const top = createElement('div', 'msg-top');

      const badgeClass = BADGE_MAP[m.platform] || 'b-api';
      const badgeLabel = LABEL_MAP[m.platform] || m.platform.toUpperCase();
      top.appendChild(createElement('span', 'badge ' + badgeClass, badgeLabel));

      if (m.enhanced && m.badges && m.badges.length > 0) {
        m.badges.forEach((badge) => {
          const badgeInfo = window.TwitchEnhanced?.getBadgeInfo(badge.name, badge.version);
          if (badgeInfo) {
            if (badgeInfo.url) {
              const badgeImg = document.createElement('img');
              badgeImg.className = 'twitch-badge-img';
              badgeImg.src = badgeInfo.url2x || badgeInfo.url;
              badgeImg.alt = badgeInfo.title || badgeInfo.name;
              badgeImg.title = badgeInfo.title || badgeInfo.name;
              badgeImg.loading = 'lazy';
              top.appendChild(badgeImg);
            } else {
              const badgeEl = createElement('span', 'twitch-badge', badgeInfo.icon || '');
              badgeEl.title = badgeInfo.name;
              top.appendChild(badgeEl);
            }
          }
        });
      }

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

      const textEl = createElement('div', 'msg-text');
      if (m.enhanced && m.emotes && m.emotes.length > 0) {
        textEl.innerHTML = renderMessageWithEmotes(m.text, m.emotes);
      } else {
        textEl.textContent = m.count > 1 ? m.text + ' (x' + m.count + ')' : m.text;
      }

      if (m.bits && m.bits > 0) {
        const bitsEl = createElement('span', 'msg-bits', `${m.bits} bits`);
        textEl.appendChild(bitsEl);
      }

      msg.appendChild(textEl);
      fragment.appendChild(msg);
    }

    list.appendChild(fragment);
    lastRenderedCount = messages.length;
    list.scrollTop = list.scrollHeight;
  }

  /**
   * Render message text with emotes
   */
  function renderMessageWithEmotes(text, emotePositions) {
    const sorted = emotePositions.sort((a, b) => a.start - b.start);

    let result = '';
    let lastIndex = 0;

    sorted.forEach((emote) => {
      result += escapeHtml(text.slice(lastIndex, emote.start));

      const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emote.id)}/default/dark/2.0`;
      if (isSafeUrl(emoteUrl)) {
        result += `<img class="emote" src="${emoteUrl}" alt="${escapeHtml(text.slice(emote.start, emote.end + 1))}" loading="lazy">`;
      } else {
        result += escapeHtml(text.slice(emote.start, emote.end + 1));
      }

      lastIndex = emote.end + 1;
    });

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
      if (emote && isSafeUrl(emote.url)) {
        return `<img class="emote" src="${emote.url}" alt="${escapeHtml(emote.code)}" title="${escapeHtml(emote.code)} (${escapeHtml(emote.provider)})" loading="lazy">`;
      }
      return escapeHtml(word);
    });

    return result.join(' ');
  }

  function clearMessages() {
    messages = [];
    lastRenderedCount = 0;
    render();
  }

  function deleteMessage(msgId) {
    const idx = messages.findIndex(m => m.msgId === msgId);
    if (idx !== -1) {
      messages.splice(idx, 1);
      lastRenderedCount = Math.max(0, lastRenderedCount - 1);
      scheduleRender();
    }
  }

  function deleteMessagesByUser(userId) {
    const before = messages.length;
    messages = messages.filter(m => m.userId !== userId);
    lastRenderedCount = Math.max(0, lastRenderedCount - (before - messages.length));
    scheduleRender();
  }

  function setBlockedWords(words) {
    blockedWords = words;
  }

  // Export to global
  window.ChatUI = {
    addMessage,
    addEnhancedMessage,
    clearMessages,
    deleteMessage,
    deleteMessagesByUser,
    setBlockedWords,
    render,
  };
})();
