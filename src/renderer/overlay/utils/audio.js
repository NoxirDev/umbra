// Audio manager module
(function() {
  'use strict';

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let settings = {
    donationSound: true,
    soundType: 'default',
    soundVolume: 50,
  };

  // Resume audio context on user interaction
  document.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  });
  audioContext.resume().catch(() => {});

  function playDonationSound() {
    if (!settings.donationSound) return;

    const volume = (settings.soundVolume || 50) / 100;
    const type = settings.soundType || 'default';

    try {
      if (audioContext.state === 'suspended') audioContext.resume();

      if (type === 'bell') {
        [800, 1000, 1200].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.1);
          gain.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + i * 0.1 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.5);
          osc.start(audioContext.currentTime + i * 0.1);
          osc.stop(audioContext.currentTime + i * 0.1 + 0.5);
        });
      } else if (type === 'coin') {
        [1000, 1500].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'square';
          gain.gain.setValueAtTime(volume * 0.2, audioContext.currentTime + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.05 + 0.1);
          osc.start(audioContext.currentTime + i * 0.05);
          osc.stop(audioContext.currentTime + i * 0.05 + 0.1);
        });
      } else if (type === 'fanfare') {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'triangle';
          gain.gain.setValueAtTime(volume * 0.25, audioContext.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
          osc.start(audioContext.currentTime + i * 0.15);
          osc.stop(audioContext.currentTime + i * 0.15 + 0.3);
        });
      } else {
        // default
        [880, 1320, 1760].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.15);
          gain.gain.linearRampToValueAtTime(volume * 0.3, audioContext.currentTime + i * 0.15 + 0.05);
          gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + i * 0.15 + 0.3);
          osc.start(audioContext.currentTime + i * 0.15);
          osc.stop(audioContext.currentTime + i * 0.15 + 0.3);
        });
      }
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }

  function updateSettings(newSettings) {
    settings = newSettings;
  }

  // Export to global
  window.AudioManager = {
    playDonationSound,
    updateSettings,
  };
})();
