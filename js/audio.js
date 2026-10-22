// Web Audio API Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Plays a two-tone gentle chime
function playAlertChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope: gentle fade in, fade out
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Low tone followed by high tone
    playTone(523.25, now, 0.4);        // C5
    playTone(659.25, now + 0.25, 0.6); // E5
  } catch (err) {
    console.warn('Audio playback waiting for user interaction:', err);
  }
}
