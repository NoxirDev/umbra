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
      const badgeClass = BADGE_MAP[m.platform] || 'b-api';
      const badgeLabel = LABEL_MAP[m.platform] || m.platform.toUpperCase();
      top.appendChild(createElement('span', 'badge ' + badgeClass, badgeLabel));

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

      const textContent = m.count > 1 ? m.text + ' (x' + m.count + ')' : m.text;
      msg.appendChild(createElement('div', 'msg-text', textContent));

      fragment.appendChild(msg);
    });

    // Clear and append in one operation
    list.innerHTML = '';
    list.appendChild(fragment);
    list.scrollTop = list.scrollHeight;
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
    clearMessages,
    setBlockedWords,
    render,
  };
})();
