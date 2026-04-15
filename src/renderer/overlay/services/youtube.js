// YouTube service module
(function() {
  'use strict';

  let pollTimeout = null;
  let nextPageToken = '';
  let videoId = '';
  let apiKey = '';
  let consecutiveErrors = 0;
  const MAX_ERRORS = 5;
  const BASE_POLL_DELAY = 5000;
  const ERROR_BACKOFF = 10000;

  async function pollChat() {
    try {
      if (!apiKey || !videoId) return;

      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
      const videoRes = await fetch(videoUrl);

      if (videoRes.status === 403) {
        consecutiveErrors++;
        console.error('[YouTube] API quota exceeded or forbidden');
        if (consecutiveErrors >= MAX_ERRORS) {
          console.error('[YouTube] Too many errors, stopping poll');
          if (window.OverlayApp?.reportError) {
            window.OverlayApp.reportError('YouTube API: квота исчерпана или доступ запрещён');
          }
          return;
        }
        pollTimeout = setTimeout(pollChat, ERROR_BACKOFF * consecutiveErrors);
        return;
      }

      if (!videoRes.ok) {
        consecutiveErrors++;
        pollTimeout = setTimeout(pollChat, ERROR_BACKOFF);
        return;
      }

      const videoData = await videoRes.json();
      const liveChatId = videoData.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) {
        consecutiveErrors = 0;
        pollTimeout = setTimeout(pollChat, BASE_POLL_DELAY * 2);
        return;
      }

      const chatUrl = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(liveChatId)}&part=snippet,authorDetails&pageToken=${encodeURIComponent(nextPageToken)}&key=${encodeURIComponent(apiKey)}`;
      const chatRes = await fetch(chatUrl);

      if (!chatRes.ok) {
        consecutiveErrors++;
        pollTimeout = setTimeout(pollChat, ERROR_BACKOFF);
        return;
      }

      consecutiveErrors = 0;
      const chatData = await chatRes.json();
      nextPageToken = chatData.nextPageToken || '';

      chatData.items?.forEach((item) => {
        const author = item.authorDetails?.displayName || 'anonymous';
        const text = item.snippet?.displayMessage || '';
        window.ChatUI.addMessage('youtube', author, text, '#ff0000', false, null);
      });

      const delay = chatData.pollingIntervalMillis || BASE_POLL_DELAY;
      pollTimeout = setTimeout(pollChat, Math.max(delay, 1000));
    } catch (e) {
      consecutiveErrors++;
      console.error('[YouTube] polling error:', e);
      if (consecutiveErrors < MAX_ERRORS) {
        pollTimeout = setTimeout(pollChat, ERROR_BACKOFF * consecutiveErrors);
      }
    }
  }

  function connect(videoIdParam, apiKeyParam) {
    if (!videoIdParam) {
      disconnect();
      return;
    }

    videoId = videoIdParam;
    apiKey = apiKeyParam;
    disconnect();
    consecutiveErrors = 0;

    if (apiKey) {
      pollChat();
    }
  }

  function disconnect() {
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = null;
    }
    nextPageToken = '';
    consecutiveErrors = 0;
  }

  window.YouTubeService = {
    connect,
    disconnect,
  };
})();
