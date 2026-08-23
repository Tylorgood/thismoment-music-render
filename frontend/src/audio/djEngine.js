const DEFAULT_EQ = { low: 0, mid: 0, high: 0 };
const DECKS = ["A", "B"];

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function equalPower(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return {
    a: Math.cos(clamped * Math.PI * 0.5),
    b: Math.cos((1 - clamped) * Math.PI * 0.5),
  };
}

export function createDjEngine() {
  let context = null;
  let master = null;
  let limiter = null;
  let crossfader = 0;
  let actionCounter = 0;
  const pendingActions = new Map();
  const decks = new Map();

  const ensureContext = () => {
    if (!context) context = createAudioContext();
    if (context && !master) {
      master = context.createGain();
      master.gain.value = 1;
      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      master.connect(limiter).connect(context.destination);
    }
    return context;
  };

  const ensureDeck = (deckId) => {
    const audioContext = ensureContext();
    if (!audioContext || !DECKS.includes(deckId)) return null;
    let deck = decks.get(deckId);
    if (deck) return deck;

    const input = audioContext.createGain();
    const trim = audioContext.createGain();
    const low = audioContext.createBiquadFilter();
    const mid = audioContext.createBiquadFilter();
    const high = audioContext.createBiquadFilter();
    const filter = audioContext.createBiquadFilter();
    const output = audioContext.createGain();

    low.type = "lowshelf";
    low.frequency.value = 320;
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 0.8;
    high.type = "highshelf";
    high.frequency.value = 3200;
    filter.type = "allpass";
    filter.frequency.value = 16000;

    input.connect(trim).connect(low).connect(mid).connect(high).connect(filter).connect(output).connect(master);
    deck = {
      id: deckId,
      input,
      trim,
      low,
      mid,
      high,
      filter,
      output,
      sourceByElement: new WeakMap(),
      eq: { ...DEFAULT_EQ },
    };
    decks.set(deckId, deck);
    updateCrossfader();
    return deck;
  };

  const updateCrossfader = () => {
    const gains = equalPower(crossfader);
    const now = context?.currentTime || 0;
    const deckA = decks.get("A");
    const deckB = decks.get("B");
    if (deckA) deckA.output.gain.setTargetAtTime(gains.a, now, 0.015);
    if (deckB) deckB.output.gain.setTargetAtTime(gains.b, now, 0.015);
  };

  const connectElement = (deckId, audioElement) => {
    const deck = ensureDeck(deckId);
    if (!deck || !audioElement) return null;
    let source = deck.sourceByElement.get(audioElement);
    if (!source) {
      source = context.createMediaElementSource(audioElement);
      source.connect(deck.input);
      deck.sourceByElement.set(audioElement, source);
    }
    audioElement.volume = 1;
    return { context, deck, source, gain: deck.output, isEngine: true };
  };

  const setCrossfader = (value) => {
    crossfader = Math.max(0, Math.min(1, Number(value) || 0));
    updateCrossfader();
  };

  const setEq = (deckId, eq = DEFAULT_EQ) => {
    const deck = ensureDeck(deckId);
    if (!deck) return;
    const now = context.currentTime;
    deck.eq = { ...deck.eq, ...eq };
    deck.low.gain.setTargetAtTime(Number(deck.eq.low) || 0, now, 0.025);
    deck.mid.gain.setTargetAtTime(Number(deck.eq.mid) || 0, now, 0.025);
    deck.high.gain.setTargetAtTime(Number(deck.eq.high) || 0, now, 0.025);
  };

  const setFilter = (deckId, filterValue = 0) => {
    const deck = ensureDeck(deckId);
    if (!deck) return;
    const value = Math.max(-1, Math.min(1, Number(filterValue) || 0));
    const now = context.currentTime;
    if (Math.abs(value) < 0.02) {
      deck.filter.type = "allpass";
      deck.filter.frequency.setTargetAtTime(16000, now, 0.025);
      return;
    }
    if (value > 0) {
      deck.filter.type = "highpass";
      deck.filter.frequency.setTargetAtTime(40 + value * 1600, now, 0.025);
    } else {
      deck.filter.type = "lowpass";
      deck.filter.frequency.setTargetAtTime(16000 + value * 15000, now, 0.025);
    }
  };

  const setTrim = (deckId, db = 0) => {
    const deck = ensureDeck(deckId);
    if (!deck) return;
    deck.trim.gain.setTargetAtTime(dbToGain(Number(db) || 0), context.currentTime, 0.025);
  };

  const setMasterVolume = (value = 1) => {
    const audioContext = ensureContext();
    if (!audioContext || !master) return;
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, Number(value) || 0)), audioContext.currentTime, 0.025);
  };

  const beatInterval = (track) => Number(track?.analysis?.beat_interval) || (track?.analysis?.bpm ? 60 / Number(track.analysis.bpm) : 0);

  const nextBeatDelayMs = (track, currentTime, minLead = 0.08, quantize = "beat") => {
    const interval = beatInterval(track);
    if (!interval) {
      return 0;
    }
    const multiplier = quantize === "bar" ? 4 : 1;
    const origin = Number(track?.analysis?.first_beat) || 0;
    const target = Math.max((Number(currentTime) || 0) + minLead, origin);
    const gridInterval = interval * multiplier;
    const beatIndex = Math.ceil((target - origin) / gridInterval);
    return Math.max(0, Math.min(2000, (origin + Math.max(0, beatIndex) * gridInterval - (Number(currentTime) || 0)) * 1000));
  };

  const scheduleAtNextBeat = (track, currentTime, callback, minLead = 0.08, quantize = "beat") => {
    const delayMs = nextBeatDelayMs(track, currentTime, minLead, quantize);
    if (!delayMs) {
      callback();
      return 0;
    }
    window.setTimeout(callback, delayMs);
    return delayMs;
  };

  const armAction = ({ track, currentTime = 0, quantize = "beat", minLead = 0.08, action }) => {
    const id = `action-${actionCounter += 1}`;
    const delayMs = nextBeatDelayMs(track, currentTime, minLead, quantize);
    const run = () => {
      pendingActions.delete(id);
      action?.();
    };
    const timeoutId = window.setTimeout(run, delayMs);
    pendingActions.set(id, { timeoutId, quantize, createdAt: Date.now() });
    return { id, delayMs };
  };

  const cancelAction = (id) => {
    const item = pendingActions.get(id);
    if (!item) return false;
    window.clearTimeout(item.timeoutId);
    pendingActions.delete(id);
    return true;
  };

  const setLimiter = ({ threshold = -4, ratio = 12, release = 0.18 } = {}) => {
    const audioContext = ensureContext();
    if (!audioContext || !limiter) return;
    const now = audioContext.currentTime;
    limiter.threshold.setTargetAtTime(Number(threshold), now, 0.025);
    limiter.ratio.setTargetAtTime(Number(ratio), now, 0.025);
    limiter.release.setTargetAtTime(Number(release), now, 0.025);
  };

  return {
    armAction,
    cancelAction,
    connectElement,
    ensureContext,
    nextBeatDelayMs,
    resume: () => ensureContext()?.resume?.(),
    scheduleAtNextBeat,
    setCrossfader,
    setEq,
    setFilter,
    setLimiter,
    setMasterVolume,
    setTrim,
  };
}
