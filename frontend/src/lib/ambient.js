const NEUTRAL = [
  [26, 24, 23],
  [30, 26, 22],
  [22, 22, 26],
];

const EMOTION_INDIGO = [192, 132, 252];
const EMOTION_PINK = [244, 114, 182];

const VALID_MODES = new Set(["dark", "wait", "stage"]);

export function clamp01(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  let cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(cleaned)) {
    cleaned = cleaned
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(cleaned)) return null;
  const value = parseInt(cleaned, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function vectorLengthSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function darken([r, g, b], amount) {
  const factor = clamp01(1 - amount);
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

export function lighten([r, g, b], amount) {
  const factor = clamp01(amount);
  return [
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  ];
}

export function rgbTriplet([r, g, b]) {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function lerpRgb(a, b, t) {
  const amount = clamp01(t);
  return [lerpChannel(a[0], b[0], amount), lerpChannel(a[1], b[1], amount), lerpChannel(a[2], b[2], amount)];
}

export function pickEmotionColor(t) {
  return lerpRgb(EMOTION_INDIGO, EMOTION_PINK, clamp01(t));
}

const ENERGY_T = {
  low: 0.22,
  mid: 0.55,
  high: 0.95,
};

export function energyFromLabel(label) {
  if (typeof label !== "string") return null;
  const normalized = label.trim().toLowerCase();
  if (normalized in ENERGY_T) return ENERGY_T[normalized];
  if (/\bhigh\b/.test(normalized)) return 0.95;
  if (/\bmid|medium\b/.test(normalized)) return 0.55;
  if (/\blow\b/.test(normalized)) return 0.22;
  return null;
}

export function neutralAmbient() {
  return NEUTRAL.map((color) => [...color]);
}

export function pickFromAnalysis(analysis) {
  if (!analysis) return neutralAmbient();
  const energyT = energyFromLabel(analysis.energy_label);
  if (energyT == null && !Number.isFinite(Number(analysis?.bpm))) return neutralAmbient();
  const bpm = Number(analysis?.bpm);
  const bpmT = Number.isFinite(bpm) && bpm > 0 ? clamp01((bpm - 80) / 70) : 0.5;
  const t = energyT != null ? energyT : 0.35 + 0.5 * bpmT;
  const confidence = clamp01(Number(analysis?.beat_confidence));
  const base = pickEmotionColor(t);
  const dim = darken(base, 0.25 + 0.3 * (1 - confidence));
  return [
    dim,
    lighten(dim, 0.05),
    lerpRgb(dim, [36, 28, 24], 0.4),
  ];
}

export function sortGlow(colors) {
  return [...colors].sort((a, b) => luminance(b) - luminance(a));
}

function spreadPalette(palette, count) {
  const want = count || 3;
  const ordered = sortGlow(palette.slice(0, 18));
  if (ordered.length === 0) return neutralAmbient();
  const picked = [ordered[0]];
  for (let i = 1; i < want && i < ordered.length; i += 1) {
    let best = ordered[i];
    let bestDistance = -1;
    for (let j = i; j < ordered.length; j += 1) {
      const candidate = ordered[j];
      const distance = Math.min(...picked.map((existing) => vectorLengthSquared(existing, candidate)));
      if (distance > bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    if (best) picked.push(best);
  }
  while (picked.length < want) picked.push([...picked[0]]);
  return picked;
}

export function buildAmbient({ source = "neutral", colors, intensity = 0, mode = "dark", meta = {} } = {}) {
  const palette = Array.isArray(colors) && colors.length ? colors.map((c) => (Array.isArray(c) && c.length === 3 ? c.slice() : null)).filter((c) => c !== null) : [];
  const spread = spreadPalette(palette.length ? palette : neutralAmbient(), 3);
  const resolvedMode = VALID_MODES.has(mode) ? mode : "dark";
  const resolvedSource = ["neutral", "scene", "analysis", "artwork"].includes(source) ? source : "neutral";
  return {
    source: resolvedSource,
    mode: resolvedMode,
    colors: spread,
    intensity: clamp01(intensity),
    meta: { ...meta },
  };
}

export function modeFor({ playing = false, scene = false } = {}) {
  if (playing) return "stage";
  if (scene) return "wait";
  return "dark";
}

export function intensityFor({ playing = false, energyT = null, confidence = 0 } = {}) {
  if (!playing) return 0.4;
  const energy = energyT != null ? clamp01(energyT) : 0.5;
  const trust = clamp01(confidence);
  return clamp01(0.55 + energy * 0.3 + trust * 0.15);
}

export function analysisKey(analysis) {
  if (!analysis) return "none";
  return [
    analysis.status,
    analysis.energy_label,
    analysis.bpm,
    analysis.key,
    analysis.beat_confidence,
  ].join("|");
}

const paletteCache = new Map();

export function readArtworkPalette(url) {
  if (typeof url !== "string" || !url) return Promise.resolve(null);
  if (paletteCache.has(url)) return paletteCache.get(url);
  const promise = sampleUrl(url)
    .catch(() => null)
    .then((palette) => (Array.isArray(palette) && palette.length ? palette : null));
  paletteCache.set(url, promise);
  return promise;
}

export function clearArtworkPaletteCache() {
  paletteCache.clear();
}

async function sampleUrl(url) {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  const width = 12;
  const height = 12;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("artwork failed to load"));
  });
  if (!image.width || !image.height) return null;

  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.n += 1;
    buckets.set(key, entry);
  }

  const averages = [...buckets.values()]
    .map((entry) => [Math.round(entry.r / entry.n), Math.round(entry.g / entry.n), Math.round(entry.b / entry.n)])
    .filter(([r, g, b]) => saturation([r, g, b]) > 0.06);
  if (!averages.length) return null;
  return averages
    .sort((a, b) => (luminance(b) + saturation(b) * 60) - (luminance(a) + saturation(a) * 60))
    .slice(0, 6);
}