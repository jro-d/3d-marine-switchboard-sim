/**
 * Synthesized Web Audio API sound effects for switching, racking,
 * proving piezo, interlock stops, and arc-flash blasts.
 */
export function createAudioEngine() {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!enabled || typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playClunk(pitch = 100) {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  function playRatchet() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  function playPiezo(doubleBeep = true) {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const beep = (t, freq) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    };
    beep(now, 2750);
    if (doubleBeep) beep(now + 0.1, 2750);
  }

  function playAlarm() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    gain.gain.setValueAtTime(0.30, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  function playInterlockBlock() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const clank = c.createOscillator();
    const clankGain = c.createGain();
    clank.type = 'triangle';
    clank.frequency.setValueAtTime(135, now);
    clank.frequency.exponentialRampToValueAtTime(42, now + 0.09);
    clankGain.gain.setValueAtTime(0.55, now);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    clank.connect(clankGain);
    clankGain.connect(c.destination);
    clank.start(now);
    clank.stop(now + 0.12);

    [0.06, 0.20].forEach((offset) => {
      const buzz = c.createOscillator();
      const bGain = c.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(165, now + offset);
      bGain.gain.setValueAtTime(0.26, now + offset);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
      buzz.connect(bGain);
      bGain.connect(c.destination);
      buzz.start(now + offset);
      buzz.stop(now + offset + 0.12);
    });
  }

  function playArcFlashBlast() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    const dur = 0.85;
    const bufSize = Math.floor(c.sampleRate * dur);
    const noiseBuf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.pow(1 - i / bufSize, 1.45);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + dur);
    filter.Q.setValueAtTime(0.9, now);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.95, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur);

    const sub = c.createOscillator();
    const subGain = c.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.48);
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    sub.connect(subGain);
    subGain.connect(c.destination);
    sub.start(now);
    sub.stop(now + 0.55);

    [60, 120, 240].forEach((freq, idx) => {
      const arcOsc = c.createOscillator();
      const arcGain = c.createGain();
      arcOsc.type = 'sawtooth';
      arcOsc.frequency.setValueAtTime(freq, now);
      arcGain.gain.setValueAtTime(0.32 / (idx + 1), now);
      arcGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      arcOsc.connect(arcGain);
      arcGain.connect(c.destination);
      arcOsc.start(now);
      arcOsc.stop(now + 0.68);
    });

    [0.28, 0.56, 0.84, 1.12].forEach((tOff, idx) => {
      const klax = c.createOscillator();
      const kGain = c.createGain();
      klax.type = 'square';
      klax.frequency.setValueAtTime(idx % 2 === 0 ? 680 : 510, now + tOff);
      kGain.gain.setValueAtTime(0.20, now + tOff);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + tOff + 0.24);
      klax.connect(kGain);
      kGain.connect(c.destination);
      klax.start(now + tOff);
      klax.stop(now + tOff + 0.25);
    });
  }

  function playSuccess() {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.18, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.32);
    });
  }

  return {
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    isEnabled() {
      return enabled;
    },
    playClunk,
    playRatchet,
    playPiezo,
    playAlarm,
    playInterlockBlock,
    playArcFlashBlast,
    playSuccess,
  };
}
