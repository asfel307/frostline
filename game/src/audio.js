// Frostline — sound: every effect is synthesized with WebAudio, so
// the game ships no audio files. The context starts on the first user
// gesture; until then every call is a safe no-op.
let ctx = null;
let master = null;

function ac() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

function burst({ freq = 180, dur = 0.12, type = 'square', gain = 0.5, slide = 0, noise = 0, when = 0 }) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + when;
  if (noise > 0) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, dur + 0.05);
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq * 4;
    const g = c.createGain();
    g.gain.setValueAtTime(gain * noise, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }
  if (type !== 'none') {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}

export const sfx = {
  shot(kind) {
    if (kind === 'rifle') burst({ freq: 150, dur: 0.1, gain: 0.5, slide: -90, noise: 0.8 });
    else if (kind === 'smg') burst({ freq: 210, dur: 0.07, gain: 0.38, slide: -110, noise: 0.7 });
    else burst({ freq: 190, dur: 0.11, gain: 0.45, slide: -80, noise: 0.6 });
  },
  enemyShot() {
    burst({ freq: 130, dur: 0.09, gain: 0.22, slide: -70, noise: 0.6 });
  },
  hit() {
    burst({ freq: 880, dur: 0.05, type: 'sine', gain: 0.3 });
  },
  kill() {
    burst({ freq: 660, dur: 0.07, type: 'sine', gain: 0.3 });
    burst({ freq: 990, dur: 0.09, type: 'sine', gain: 0.3, when: 0.07 });
  },
  hurt() {
    burst({ freq: 110, dur: 0.14, gain: 0.5, slide: -40, noise: 0.5 });
  },
  reload() {
    burst({ freq: 1200, dur: 0.04, type: 'sine', gain: 0.22 });
    burst({ freq: 900, dur: 0.04, type: 'sine', gain: 0.22, when: 0.35 });
  },
  dry() {
    burst({ freq: 1400, dur: 0.03, type: 'sine', gain: 0.18 });
  },
  plant() {
    burst({ freq: 520, dur: 0.09, type: 'sine', gain: 0.3 });
    burst({ freq: 520, dur: 0.09, type: 'sine', gain: 0.3, when: 0.18 });
  },
  planted() {
    burst({ freq: 440, dur: 0.12, type: 'sine', gain: 0.35 });
    burst({ freq: 660, dur: 0.16, type: 'sine', gain: 0.35, when: 0.14 });
  },
  beep() {
    burst({ freq: 980, dur: 0.06, type: 'sine', gain: 0.25 });
  },
  explosion() {
    burst({ freq: 90, dur: 0.7, gain: 0.9, slide: -50, noise: 1, type: 'none' });
    burst({ freq: 55, dur: 0.9, gain: 0.7, slide: -25, noise: 0.4 });
  },
  roundWin() {
    [523, 659, 784].forEach((f, i) => burst({ freq: f, dur: 0.14, type: 'sine', gain: 0.3, when: i * 0.12 }));
  },
  roundLose() {
    [392, 330, 262].forEach((f, i) => burst({ freq: f, dur: 0.16, type: 'sine', gain: 0.28, when: i * 0.13 }));
  },
  buy() {
    burst({ freq: 1046, dur: 0.06, type: 'sine', gain: 0.25 });
    burst({ freq: 1318, dur: 0.08, type: 'sine', gain: 0.25, when: 0.06 });
  },
  step() {
    burst({ freq: 70, dur: 0.05, gain: 0.1, noise: 0.5, type: 'none' });
  },
};
