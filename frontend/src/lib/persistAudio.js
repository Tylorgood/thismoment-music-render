import { createDjEngine } from "../audio/djEngine";
import { setTheaterContext, getTheaterContext } from "@/lib/theaterContext";
import { attachEngine } from "@/lib/reactiveBus";

let engine = null;
let live = null;
let liveMeta = null;
let pageControl = null;
let tickId = null;
let lastAdoptedElement = null;
let lastPulseAt = 0;
let publishHook = null;
let publishCount = 0;
let deckElement = null;
let hostElement = null;
const EQ_BANDS = 5;
const EQ_BAND_BIAS = [0.9, 1, 1.1, 0.95, 0.75];
const WAVE_BUCKETS = 64;
const wavePeaksCache = new Map();
let transportState = null;

export function getEngine() {
  if (typeof window === "undefined") return null;
  if (!engine) engine = createDjEngine();
  return engine;
}

export function getLive() {
  return live;
}

function ensureHost() {
  if (typeof document === "undefined") return null;
  if (hostElement && document.body.contains(hostElement)) return hostElement;
  hostElement = document.getElementById("ma-audio-host");
  if (!hostElement) {
    hostElement = document.createElement("div");
    hostElement.id = "ma-audio-host";
    hostElement.setAttribute("aria-hidden", "true");
    hostElement.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(hostElement);
  }
  return hostElement;
}

export function getDeckElement() {
  if (typeof document === "undefined") return null;
  if (!deckElement) {
    deckElement = new Audio();
    deckElement.preload = "metadata";
    deckElement.controls = true;
    deckElement.dataset.deckId = "A";
    deckElement.__persistent = true;
  }
  if (!deckElement.isConnected) {
    const host = ensureHost();
    if (host) host.appendChild(deckElement);
  }
  return deckElement;
}

export function parkDeckElement() {
  if (!deckElement) return;
  const host = ensureHost();
  if (host && deckElement.parentNode !== host) host.appendChild(deckElement);
}

export function getLiveMeta() {
  return liveMeta ? { ...liveMeta } : null;
}

export function setPublishHook(fn) {
  publishHook = fn;
}

export function registerPageControl(control) {
  pageControl = control;
  if (publishHook) publishHook();
}

export function clearPageControl() {
  pageControl = null;
}

function publish() {
  if (!live) return;
  publishCount += 1;
  const playing = !live.paused && !live.ended;
  const payload = {
    playing,
    currentTime: live.currentTime || 0,
    duration: Number.isFinite(live.duration) && live.duration >= 0 ? live.duration : 0,
    ...(liveMeta || {}),
  };
  const current = getTheaterContext();
  setTheaterContext({ ...(current && typeof current === "object" ? current : {}), ...payload });
  if (publishHook) publishHook(payload);
}

export function adopt(audio, meta = null) {
  if (!audio || typeof window === "undefined") return;
  live = audio;
  liveMeta = meta ? { ...meta } : null;
  lastAdoptedElement = audio;
  attachEngine(getEngine());
  ensureTicker();
  publish();
}

function ensureTicker() {
  if (typeof window === "undefined") return;
  if (tickId != null) return;
  const run = () => {
    if (!live) {
      window.clearInterval(tickId);
      tickId = null;
      return;
    }
    publish();
  };
  tickId = window.setInterval(run, 250);
}

function stopTicker() {
  if (typeof window === "undefined") return;
  if (tickId != null) {
    window.clearInterval(tickId);
    tickId = null;
  }
}

export function detach() {
  live = null;
  liveMeta = null;
  lastAdoptedElement = null;
  stopTicker();
}

export function forcePublish() {
  publish();
}

export function getWaveformPeaks(src) {
  if (!src || typeof window === "undefined") return Promise.resolve(null);
  if (wavePeaksCache.has(src)) return wavePeaksCache.get(src);
  const promise = decodeWaveformPeaks(src)
    .catch(() => null)
    .then((peaks) => (Array.isArray(peaks) && peaks.length ? peaks : null));
  wavePeaksCache.set(src, promise);
  return promise;
}

async function decodeWaveformPeaks(src) {
  const engine = getEngine();
  const context = engine ? engine.getContext() : null;
  if (!context) return null;
  const response = await fetch(src);
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(buffer);
  const channel = audioBuffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(channel.length / WAVE_BUCKETS));
  const peaks = new Array(WAVE_BUCKETS);
  for (let index = 0; index < WAVE_BUCKETS; index += 1) {
    const start = index * bucketSize;
    const end = Math.min(channel.length, start + bucketSize);
    let sum = 0;
    let peak = 0;
    let samples = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 16) {
      const value = Math.abs(channel[sampleIndex]);
      sum += value * value;
      peak = Math.max(peak, value);
      samples += 1;
    }
    const rms = samples ? Math.sqrt(sum / samples) : 0;
    peaks[index] = Math.max(0.04, Math.min(1, 0.18 + rms * 1.7 + peak * 0.9));
  }
  return peaks;
}

export function seekTo(fraction, duration) {
  if (!live || !Number.isFinite(fraction)) return;
  const targetSeconds = Math.max(0, Number(fraction) * (Number(duration) || live.duration || 0));
  if (pageControl && typeof pageControl.seekTo === "function") {
    pageControl.seekTo(targetSeconds);
    return;
  }
  const clamped = Math.min(targetSeconds, live.duration || targetSeconds);
  live.currentTime = clamped;
  publish();
}

export function skipPrev() {
  if (!live) return;
  if (pageControl && typeof pageControl.skipPrev === "function") {
    pageControl.skipPrev();
    return;
  }
  if (live.currentTime > 3) {
    live.currentTime = 0;
  } else if (pageControl && typeof pageControl.seekBy === "function") {
    pageControl.seekBy();
  }
  publish();
}

function loadTransportState() {
  if (transportState) return transportState;
  if (typeof window === "undefined") {
    transportState = { shuffle: false, repeat: false };
    return transportState;
  }
  transportState = { shuffle: false, repeat: false };
  try {
    const raw = window.localStorage.getItem("ma-transport-mode");
    if (raw) transportState = { ...transportState, ...JSON.parse(raw) };
  } catch {
    void raw;
  }
  return transportState;
}

export function getTransportState() {
  return { ...loadTransportState() };
}

export function setTransportState(patch) {
  const next = { ...loadTransportState(), ...patch };
  transportState = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("ma-transport-mode", JSON.stringify(next));
    } catch {
      void next;
    }
  }
  return { ...next };
}

export function toggle() {
  if (!live) return;
  if (pageControl && typeof pageControl.toggle === "function") {
    pageControl.toggle();
    return;
  }
  if (live.paused || live.ended) {
    try {
      const result = live.play();
      if (result && typeof result.then === "function") result.catch(() => {});
    } catch {
      /* keep state as-is */
    }
  } else {
    try {
      live.pause();
    } catch {
      /* keep state as-is */
    }
  }
  publish();
}

export function hasControls() {
  return Boolean(pageControl && typeof pageControl.skipNext === "function");
}

export function skipNext() {
  if (!pageControl || typeof pageControl.skipNext !== "function") return;
  pageControl.skipNext();
}

export function seekBy(seconds) {
  if (!live) return;
  if (pageControl && typeof pageControl.seek === "function") {
    pageControl.seek(seconds);
    return;
  }
  const target = Math.max(0, (live.currentTime || 0) + seconds);
  live.currentTime = target;
  publish();
}

export function sampleEq() {
  const levels = Array.from({ length: EQ_BANDS }, () => 0.08);
  if (typeof window === "undefined" || !live || live.paused || live.ended) return levels;
  const bpm = Number(liveMeta?.bpm) || 120;
  const interval = 60000 / bpm;
  const now = performance.now();
  if (now - lastPulseAt >= interval) lastPulseAt = now;
  const inBeat = (now - lastPulseAt) / interval;
  if (inBeat > 1) lastPulseAt = now;
  const progress = inBeat <= 1 ? inBeat : 0;
  const attack = progress < 0.18 ? progress / 0.18 : Math.max(0, 1 - (progress - 0.18) / 0.82);
  for (let i = 0; i < EQ_BANDS; i += 1) {
    levels[i] = Math.max(0.08, Math.min(1, attack * (0.45 + EQ_BAND_BIAS[i] * 0.3) + 0.08));
  }
  return levels;
}

export function resetSession() {
  detach();
  engine = null;
  lastAdoptedElement = null;
  lastPulseAt = 0;
  pageControl = null;
  publishHook = null;
  publishCount = 0;
}

if (typeof window !== "undefined") {
  window.__maAudioDebug = {
    live: () => live,
    meta: () => (liveMeta ? { ...liveMeta } : null),
    isPlaying: () => Boolean(live && !live.paused && !live.ended),
    currentTime: () => (live ? live.currentTime : null),
    duration: () => (live ? live.duration : null),
    isPaused: () => (live ? live.paused : null),
    skippable: () => hasControls(),
    enginePresent: () => Boolean(engine),
    publishCount: () => publishCount,
  };
}