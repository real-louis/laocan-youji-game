const AudioManager = (function () {
  'use strict';

  let ctx = null;
  let enabled = true;
  let ambientOsc = null;
  let ambientGain = null;

  function loadPreference() {
    const saved = localStorage.getItem('laocan_sound');
    if (saved !== null) enabled = saved === 'on';
    updateToggleUI();
  }

  function savePreference() {
    localStorage.setItem('laocan_sound', enabled ? 'on' : 'off');
  }

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.12, delay = 0) {
    if (!enabled) return;
    const ac = ensureContext();
    if (!ac) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
  }

  function playGuqinPluck(baseFreq, volume = 0.1) {
    if (!enabled) return;
    const ac = ensureContext();
    if (!ac) return;

    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.8);

    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  const sounds = {
    click() {
      playGuqinPluck(392, 0.08);
    },

    hover() {
      playTone(523, 0.06, 'sine', 0.04);
    },

    choice() {
      playGuqinPluck(329, 0.1);
      setTimeout(() => playGuqinPluck(440, 0.06), 80);
    },

    feedback() {
      [440, 554, 659].forEach((f, i) => playTone(f, 0.3, 'sine', 0.07, i * 0.12));
    },

    statUp() {
      playTone(660, 0.15, 'sine', 0.06);
    },

    statDown() {
      playTone(330, 0.2, 'sine', 0.05);
    },

    levelComplete() {
      [392, 494, 587, 659].forEach((f, i) => playGuqinPluck(f, 0.07 - i * 0.005));
    },

    transition() {
      playTone(220, 0.25, 'sine', 0.05);
    },

    ending() {
      const melody = [392, 440, 494, 523, 587, 659, 587, 523];
      melody.forEach((f, i) => playGuqinPluck(f, 0.09 - i * 0.003));
    },

    unlock() {
      playTone(784, 0.2, 'sine', 0.08);
      setTimeout(() => playTone(988, 0.25, 'sine', 0.07), 100);
    },

    locked() {
      playTone(200, 0.15, 'square', 0.03);
    }
  };

  function startAmbient() {
    if (!enabled || ambientOsc) return;
    const ac = ensureContext();
    if (!ac) return;

    ambientGain = ac.createGain();
    ambientGain.gain.value = 0.012;
    ambientGain.connect(ac.destination);

    ambientOsc = ac.createOscillator();
    ambientOsc.type = 'sine';
    ambientOsc.frequency.value = 110;
    ambientOsc.connect(ambientGain);
    ambientOsc.start();
  }

  function stopAmbient() {
    if (ambientOsc) {
      try { ambientOsc.stop(); } catch (_) { /* already stopped */ }
      ambientOsc.disconnect();
      ambientOsc = null;
    }
    if (ambientGain) {
      ambientGain.disconnect();
      ambientGain = null;
    }
  }

  function toggle() {
    enabled = !enabled;
    savePreference();
    updateToggleUI();
    if (enabled) {
      startAmbient();
      playGuqinPluck(440, 0.08);
    } else {
      stopAmbient();
    }
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function updateToggleUI() {
    const btn = document.getElementById('btn-sound');
    if (!btn) return;
    btn.textContent = enabled ? '🔊' : '🔇';
    btn.title = enabled ? '關閉音效' : '開啟音效';
    btn.setAttribute('aria-label', enabled ? '關閉音效' : '開啟音效');
  }

  function init() {
    loadPreference();
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      ensureContext();
      toggle();
    });

    document.body.addEventListener('click', function boot() {
      ensureContext();
      if (enabled) startAmbient();
      document.body.removeEventListener('click', boot);
    }, { once: true });
  }

  function playChoiceEffects(effects) {
    if (!effects) return;
    const net = (effects.ren || 0) + (effects.dong || 0) + (effects.ming || 0);
    if (net > 0) sounds.statUp();
    else if (net < 0) sounds.statDown();
  }

  return {
    init,
    play: (name) => sounds[name]?.(),
    playChoiceEffects,
    toggle,
    isEnabled,
    startAmbient,
    stopAmbient
  };
})();
