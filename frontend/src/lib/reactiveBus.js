const TAU = Math.PI * 2;

export const BAND_RANGES = {
  bass: [20, 140],
  low: [140, 350],
  mid: [350, 2000],
  high: [2000, 6000],
  air: [6000, 14000],
};

export const TIME_CONSTANTS = {
  mood: 30,
  zeroDistance: 20,
  breathe: 4,
  energy: 2,
  bass: 0.22,
  low: 0.2,
  mid: 0.18,
  high: 0.12,
  air: 0.09,
  shimmer: 0.14,
  penetrate: 3,
  transient: 0.18,
};

const MAX_BANDS = Object.keys(BAND_RANGES).length;

const BASE_STATE = {
  bass: 0,
  low: 0,
  mid: 0,
  high: 0,
  air: 0,
  transient: 0,
  shimmer: 0,
  energy: 0,
  mood: 0.5,
  zeroDistance: 0.5,
  bpmPhase: 0,
  breathe: 0,
  penetrate: 0.4,
  playing: false,
  frame: 0,
};

let analyser = null;
let freqData = null;
let timeData = null;
let attachedMaster = null;
let sampleRate = 44100;
let fftSize = 2048;
let running = false;
let rafId = 0;
let lastTs = 0;
let lastCssTs = 0;
let startedAt = 0;
let cssRoot = null;
let metadata = { bpm: 0, energy_label: null, firstBeat: 0, zeroDistance: null, emotionT: null };
let runningAvg = 0;
const state = { ...BASE_STATE };
const subscribers = new Set();

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function env(prev, target, dt, attack, release) {
  const tau = target > prev ? attack : release;
  if (!(tau > 0)) return target;
  const amount = 1 - Math.exp(-Math.max(0, dt) / tau);
  return prev + (target - prev) * amount;
}

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function bandAverage(data, sr, size, [lo, hi]) {
  if (!data || !data.length || !size) return 0;
  const binHz = sr / size;
  const from = Math.max(1, Math.floor(lo / binHz));
  const to = Math.min(data.length - 1, Math.ceil(hi / binHz));
  if (to < from) return 0;
  let sum = 0;
  let count = 0;
  for (let i = from; i <= to; i += 1) {
    sum += data[i] / 255;
    count += 1;
  }
  return count ? sum / count : 0;
}

export function bandVector(data, sr, size) {
  const bands = {};
  for (const [name, range] of Object.entries(BAND_RANGES)) {
    bands[name] = bandAverage(data, sr, size, range);
  }
  return bands;
}

export function specShimmer(air, strength = 1) {
  return clamp01(air * (0.6 + 0.4 * clamp01(strength)));
}

export function attachEngine(engine) {
  if (!engine || typeof engine.getMaster !== "function") return false;
  const context = engine.getContext ? engine.getContext() : engine.ensureContext?.();
  const master = engine.getMaster();
  if (!context || !master) return false;
  if (analyser && attachedMaster === master) return true;
  try {
    fftSize = 2048;
    sampleRate = context.sampleRate || 44100;
    analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.62;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    master.connect(analyser);
    attachedMaster = master;
    startedAt = context.currentTime || 0;
    return true;
  } catch (error) {
    analyser = null;
    attachedMaster = null;
    return false;
  }
}

export function detachEngine() {
  if (analyser && attachedMaster) {
    try {
      attachedMaster.disconnect(analyser);
    } catch (error) {
      void error;
    }
  }
  analyser = null;
  freqData = null;
  attachedMaster = null;
}

export function setMetadata(next = {}) {
  metadata = { ...metadata, ...next };
}

export function getMetadata() {
  return metadata;
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  subscribers.add(listener);
  start();
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) stop();
  };
}

export function resetForTests() {
  stop();
  subscribers.clear();
  detachEngine();
  Object.assign(state, BASE_STATE);
  metadata = { bpm: 0, energy_label: null, firstBeat: 0, zeroDistance: null, emotionT: null };
  runningAvg = 0;
}

function energyTarget() {
  const label = String(metadata.energy_label || "").toLowerCase();
  if (label.includes("high")) return 1;
  if (label.includes("mid") || label.includes("medium")) return 0.6;
  if (label.includes("low")) return 0.28;
  const bpm = Number(metadata.bpm);
  if (Number.isFinite(bpm) && bpm > 0) return clamp01((bpm - 80) / 70);
  return 0.5;
}

function step(dt) {
  state.frame += 1;
  state.playing = Boolean(metadata.playing);

  let bass = 0;
  let low = 0;
  let mid = 0;
  let high = 0;
  let air = 0;

  if (analyser && freqData) {
    analyser.getByteFrequencyData(freqData);
    const bands = bandVector(freqData, sampleRate, fftSize);
    bass = bands.bass;
    low = bands.low;
    mid = bands.mid;
    high = bands.high;
    air = bands.air;
  } else if (state.playing) {
    const t = performance.now() / 1000;
    const bpm = Number(metadata.bpm) || 0;
    const pulse = bpm > 0 ? Math.max(0, Math.sin(t * TAU * (bpm / 60))) : 0.4;
    bass = 0.3 + 0.25 * pulse;
    low = 0.34 + 0.2 * pulse;
    mid = 0.3 + 0.12 * Math.sin(t * 1.7);
    high = 0.22 + 0.1 * Math.sin(t * 3.3);
    air = 0.18 + 0.08 * Math.sin(t * 5.1);
  }

  state.bass = env(state.bass, bass, dt, 0.05, TIME_CONSTANTS.bass);
  state.low = env(state.low, low, dt, 0.05, TIME_CONSTANTS.low);
  state.mid = env(state.mid, mid, dt, 0.06, TIME_CONSTANTS.mid);
  state.high = env(state.high, high, dt, 0.04, TIME_CONSTANTS.high);
  state.air = env(state.air, air, dt, 0.035, TIME_CONSTANTS.air);

  const overall = (state.bass + state.low + state.mid + state.high + state.air) / MAX_BANDS;
  runningAvg = env(runningAvg, overall, dt, 0.5, 0.7);

  let transient = 0;
  if (overall > runningAvg * 1.28 + 0.03) {
    transient = clamp01((overall - runningAvg) * 3.2);
  }
  state.transient = Math.max(transient, env(state.transient, 0, dt, TIME_CONSTANTS.transient, TIME_CONSTANTS.transient));

  state.energy = env(state.energy, state.playing ? overall : 0, dt, 0.8, TIME_CONSTANTS.energy);
  state.breathe = env(state.breathe, state.playing ? state.bass : 0.06, dt, TIME_CONSTANTS.breathe * 0.6, TIME_CONSTANTS.breathe);
  state.shimmer = env(state.shimmer, state.playing ? clamp01(state.air * 0.9 + state.high * 0.35) : 0, dt, 0.04, TIME_CONSTANTS.shimmer);

  const moodTarget = metadata.emotionT == null ? energyTarget() : clamp01(Number(metadata.emotionT) * 0.6 + energyTarget() * 0.4);
  state.mood = env(state.mood, moodTarget, dt, TIME_CONSTANTS.mood, TIME_CONSTANTS.mood);

  const zTarget = metadata.zeroDistance == null ? 0.5 : clamp01(Number(metadata.zeroDistance));
  state.zeroDistance = env(state.zeroDistance, zTarget, dt, TIME_CONSTANTS.zeroDistance, TIME_CONSTANTS.zeroDistance);

  state.penetrate = env(state.penetrate, 0.32 + state.energy * 0.6, dt, TIME_CONSTANTS.penetrate, TIME_CONSTANTS.penetrate);

  const bpm = Number(metadata.bpm) || 0;
  if (bpm > 0 && state.playing) {
    const now = performance.now() / 1000;
    const origin = Number(metadata.firstBeat) || 0;
    state.bpmPhase = (((now - origin) * (bpm / 60)) % 1 + 1) % 1;
  } else {
    state.bpmPhase = (state.bpmPhase + dt * 0.12) % 1;
  }
}

function publishCss() {
  if (!isBrowser()) return;
  if (!cssRoot) cssRoot = document.documentElement;
  if (!cssRoot) return;
  const style = cssRoot.style;
  style.setProperty("--ma-react-bass", state.bass.toFixed(3));
  style.setProperty("--ma-react-low", state.low.toFixed(3));
  style.setProperty("--ma-react-mid", state.mid.toFixed(3));
  style.setProperty("--ma-react-high", state.high.toFixed(3));
  style.setProperty("--ma-react-air", state.air.toFixed(3));
  style.setProperty("--ma-react-transient", state.transient.toFixed(3));
  style.setProperty("--ma-react-shimmer", state.shimmer.toFixed(3));
  style.setProperty("--ma-react-breathe", state.breathe.toFixed(3));
  style.setProperty("--ma-react-energy", state.energy.toFixed(3));
  style.setProperty("--ma-react-penetrate", state.penetrate.toFixed(3));
  style.setProperty("--ma-react-mood", state.mood.toFixed(3));
}

function debugSnapshot() {
  return {
    ...state,
    attached: Boolean(analyser),
    mood: Number(state.mood.toFixed(3)),
    zeroDistance: Number(state.zeroDistance.toFixed(3)),
  };
}

function frame(ts) {
  if (!running) return;
  rafId = window.requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  step(dt);
  if (typeof window !== "undefined") window.__reactiveDebug = debugSnapshot();
  subscribers.forEach((listener) => {
    try {
      listener(state, dt);
    } catch (error) {
      void error;
    }
  });
  if (ts - lastCssTs > 100) {
    lastCssTs = ts;
    publishCss();
  }
}

export function start() {
  if (!isBrowser() || running) return;
  running = true;
  lastTs = 0;
  rafId = window.requestAnimationFrame(frame);
}

export function stop() {
  running = false;
  if (rafId && typeof window !== "undefined") window.cancelAnimationFrame(rafId);
  rafId = 0;
}

export const __test = {
  env,
  energyTarget,
  stepTimes: TIME_CONSTANTS,
};
