// YouTube service module
(function() {
  'use strict';

  let pollInterval = null;
  let nextPageToken = '';
  let videoId = '';
  let apiKey = '';

  async function pollChat() {
    try {
      if (!apiKey) return;

      // Get liveChatId from video
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) return;
      const videoData = await videoRes.json();
      const liveChatId = videoData.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) return;

      // Get chat messages
      const chatUrl = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&pageToken=${nextPageToken}&key=${apiKey}`;
      const chatRes = await fetch(chatUrl);
      if (!chatRes.ok) return;
      const chatData = await chatRes.json();

      nextPageToken = chatData.nextPageToken || '';

      chatData.items?.forEach((item) => {
        const author = item.authorDetails?.displayName || 'anonymous';
        const text = item.snippet?.displayMessage || '';
        window.ChatUI.addMessage('youtube', author, text, '#ff0000', false, null);
      });

      // Schedule next poll
      const delay = chatData.pollingIntervalMillis || 5000;
      pollInterval = setTimeout(pollChat, delay);
    } catch (e) {
      console.error('[YouTube] polling error:', e);
      pollInterval = setTimeout(pollChat, 10000);
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

    if (apiKey) {
      pollChat();
    }
  }

  function disconnect() {
    if (pollInterval) {
      clearTimeout(pollInterval);
      pollInterval = null;
    }
    nextPageToken = '';
  }

  // Export to global
  window.YouTubeService = {
    connect,
    disconnect,
  };
})();
