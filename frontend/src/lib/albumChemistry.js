import { EMOTION_META, ALBUM_ARCHETYPES } from "./promptEngine";

// Role intensity lookups are mirrored here (used only for chemistry math; the
// canonical role definitions stay in albumEngine so chemistry stays pure).
const ROLE_INTENSITY = {
  opener: 0.55,
  body: 0.62,
  lift: 0.78,
  interlude: 0.3,
  climax: 1,
  descent: 0.5,
  closer: 0.45,
};

/*
 * Album Chemistry — 8-dimensional per-track emotional targets.
 *
 * The album-level blend/centroid is a gravitational center, NOT the answer
 * copied onto every song. Each track's chemistry emerges from:
 *  - album DNA (archetype + blend)
 *  - wizard intent (begin/end/trajectory energy)
 *  - role position in the arc
 *  - previous track (inheritance — what "survives")
 *  - next-track requirement (what the next track demands)
 *  - trajectory shape (orbit / climb / crest / wave / resolution)
 *  - climax / plateau behavior
 *  - ending target
 *
 * Orbit/plateau architectures keep chemistry steady (no forced
 * transformation). Climax architectures accumulate momentum through
 * accumulated trajectory until the peak emerges.
 */

// ── emotion key ordering ────────────────────────────────────────────────

export const CHEMISTRY_KEYS = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
];

const EMOTION_TO_PROFILE = Object.fromEntries(
  EMOTION_META.map((m) => [m.word, m.key])
);

// ── role modulation maps ────────────────────────────────────────────────
// Each role biases the 8-dim chemistry by shifting specific emotions.
// Values are soft scalars applied to the track's delta from genome.

const ROLE_CHEMISTRY_BIAS = {
  opener: { trust: 12, anticipation: 8, joy: 6, fear: -4 },
  body: { trust: 6, sadness: 6, anticipation: 4 },
  lift: { joy: 10, surprise: 6, anticipation: 8, trust: 4 },
  interlude: { sadness: 10, trust: -4, anticipation: -8, surprise: -4 },
  climax: { fear: 14, anger: 12, anticipation: 16, surprise: 14, joy: -4 },
  descent: { sadness: 10, trust: 6, anger: -8, fear: -6, anticipation: -6 },
  closer: { trust: 14, joy: 10, sadness: 8, anger: -10, fear: -8 },
};

// ── trajectory modulation ───────────────────────────────────────────────
// Each trajectory describes the per-slot emotional arc (values are
// *additional* scalars per emotion, applied at each position along the
// trajectory as the track approaches its climax.)

function linearRamp(trackCount, peakIndex) {
  return Array.from({ length: trackCount }, (_, i) => {
    const t = i <= peakIndex ? i / peakIndex : 1 - (i - peakIndex) / (trackCount - 1 - peakIndex || 1);
    return t;
  });
}

function waveShape(trackCount, peakIndex) {
  return Array.from({ length: trackCount }, (_, i) => {
    const mid = trackCount / 2;
    const x = Math.sin((i / trackCount) * Math.PI * 2);
    const climaxPull = Math.max(0, 1 - Math.abs(i - peakIndex) / trackCount);
    return (x * 0.3 + climaxPull * 0.7);
  });
}

function orbitShape(trackCount) {
  return Array.from({ length: trackCount }, () => 0);
}

function crescendoShape(trackCount) {
  return Array.from({ length: trackCount }, (_, i) => (i / (trackCount - 1)) ** 1.8);
}

// ── chemistry algebra ───────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function addChem(a, b) {
  return CHEMISTRY_KEYS.map((k, i) => clamp((a[i] ?? 0) + (b[i] ?? 0), 0, 100));
}

function mulChem(a, k) {
  return CHEMISTRY_KEYS.map((k2, i) => clamp((a[i] ?? 0) * k, 0, 100));
}

function lerpChem(a, b, t) {
  return CHEMISTRY_KEYS.map((k, i) => clamp((a[i] ?? 0) * (1 - t) + (b[i] ?? 0) * t, 0, 100));
}

function zeros() {
  return CHEMISTRY_KEYS.map(() => 0);
}

// ── genome: archetype profile → 8-dim album-level target ────────────────

export function profileToGenome(profile) {
  return CHEMISTRY_KEYS.map((k) => {
    const pkey = EMOTION_TO_PROFILE[k];
    return clamp(Math.round(profile[pkey] ?? 50), 0, 100);
  });
}

// ── trajectory from genome + arc ────────────────────────────────────────

function buildTrajectory({ genome, role, slotIndex, climaxIndex, trackCount, prev, next, endTarget }) {
  const t = slotIndex / (trackCount - 1 || 1);
  const distFromClimax = (slotIndex - climaxIndex) / (trackCount - 1 || 1);
  const isBeforeClimax = slotIndex <= climaxIndex;
  const isAfterClimax = slotIndex > climaxIndex;

  const delta = zeros();

  // Climax-specific emotions surge toward peak
  if (role.id === "climax") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      if (["fear", "anger", "anticipation", "surprise"].includes(k)) {
        delta[i] += 18 + genome[i] * 0.15;
      } else if (["sadness", "disgust"].includes(k)) {
        delta[i] += 6;
      } else if (["joy", "trust"].includes(k)) {
        delta[i] -= 6;
      }
    });
  }

  // Opening establishes genome (high trust/joy, low fear/anger)
  if (role.id === "opener") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      const target = genome[i] * 0.6;
      delta[i] += target * (isBeforeClimax ? 0.3 : -0.1);
    });
  }

  // Body: gentle genome-pull per emotion, proportional to how far from genome
  if (role.id === "body") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      delta[i] += (genome[i] - 50) * 0.12;
    });
  }

  // Interlude: thin, rest, introduce space; slight dip in dominant emotions
  if (role.id === "interlude") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      delta[i] -= 8;
    });
  }

  // Lift: lift before climax; anticipation/joy/surprise surge, fear stays low
  if (role.id === "lift") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      if (["anticipation", "surprise", "joy"].includes(k)) delta[i] += 14;
      else if (["fear", "anger"].includes(k)) delta[i] += 4;
    });
  }

  // Descent: wind down; trust/sadness settle, anger/fear recede
  if (role.id === "descent") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      if (["sadness", "trust"].includes(k)) delta[i] += 6;
      else if (["fear", "anger", "anticipation", "surprise"].includes(k)) delta[i] -= 10;
    });
  }

  // Closer: warm resolution; high trust/joy, gentle sadness, low fear
  if (role.id === "closer") {
    CHEMISTRY_KEYS.forEach((k, i) => {
      if (["trust", "joy"].includes(k)) delta[i] += 14;
      else if (["sadness"].includes(k)) delta[i] += 4;
      else if (["fear", "anger", "disgust"].includes(k)) delta[i] -= 12;
    });
  }

  return delta;
}

// ── residual: what survives between tracks ──────────────────────────────

export function residualChemistry(current, previous, threshold = 6) {
  const inherited = [];
  const strengthened = [];
  const reduced = [];
  const introduced = [];

  CHEMISTRY_KEYS.forEach((k, i) => {
    const prevVal = previous[i] ?? 0;
    const currVal = current[i] ?? 0;
    const delta = currVal - prevVal;

    const isPresentNow = currVal >= 20;
    const wasPresentBefore = prevVal >= 18;

    if (wasPresentBefore && isPresentNow && Math.abs(delta) < threshold) {
      inherited.push(k);
    }
    if (delta >= threshold) strengthened.push(k);
    if (delta <= -threshold && wasPresentBefore) reduced.push(k);
    if (!wasPresentBefore && isPresentNow && currVal >= 25) introduced.push(k);
  });

  return { inherited, strengthened, reduced, introduced };
}

// ── describe: purpose in plain language ─────────────────────────────────

function describePurpose({ role, slotIndex, climaxIndex, trackCount, inherited, introduced, strengthened, reduced, prev, next, genome }) {
  const pos = slotIndex === 0
    ? "opening"
    : slotIndex === trackCount - 1
    ? "closing"
    : slotIndex === climaxIndex
    ? "climax"
    : slotIndex < climaxIndex
    ? "building toward the climax"
    : "resolving after the peak";

  const carryLine = inherited.length
    ? `Borrows ${inherited.slice(0, 2).join(" and ")} from the previous track.`
    : "";
  const changeLine = introduced.length || strengthened.length
    ? `Introduces ${[...introduced, ...strengthened].slice(0, 2).join(" and ")} energy.`
    : "";
  const reductionLine = reduced.length
    ? `Lets ${reduced.slice(0, 2).join(" and ")} fade.`
    : "";

  return [carryLine, changeLine, reductionLine].filter(Boolean).join(" ") || `Holds the album's emotional center.`;
}

// ── composeChemistry: the main public API ───────────────────────────────

export function composeChemistry({
  genome,
  role,
  slotIndex,
  climaxIndex,
  trackCount,
  prev,
  next,
  endTarget,
  prevResidual,
}) {
  const bias = ROLE_CHEMISTRY_BIAS[role.id] || {};
  const trajectoryDelta = buildTrajectory({
    genome,
    role,
    slotIndex,
    climaxIndex,
    trackCount,
    prev,
    next,
    endTarget,
  });

  // Start from genome and add trajectory + role biases
  let raw = addChem(genome, trajectoryDelta);

  // Apply role bias
  CHEMISTRY_KEYS.forEach((k, i) => {
    raw[i] += (bias[k] ?? 0);
  });

  // Inheritance: if previous chemistry exists, blend ~55% prev + 45% raw
  // (closer tracks = more momentum, further = more genome-pull)
  let blended;
  if (prev) {
    const momentum = Math.max(0.35, 0.6 - (slotIndex / trackCount) * 0.15);
    blended = lerpChem(raw, prev, momentum);
  } else {
    blended = raw;
  }

  // Clamp all to 0..100
  const values = CHEMISTRY_KEYS.map((_, i) => clamp(Math.round(blended[i]), 0, 100));

  // Activation (mean_energy analog) and intensity
  const activation = clamp(Math.round(
    values.reduce((sum, v, i) => sum + v * (["anger", "anticipation", "fear", "surprise"].includes(CHEMISTRY_KEYS[i]) ? 1.2 : 0.8), 0) / 800 * 100
  ), 10, 100);
  const intensity = clamp(Math.round(role.intensity * 100), 10, 100);
  // Zero distance: how far this track's chemistry has drifted from the
  // gravitational center (album genome). High distance = "otherness".
  const zeroDistance = clamp(Math.round(
    values.reduce((sum, v, i) => sum + Math.abs(v - genome[i]), 0)
  ), 5, 95);

  // Dominant emotions
  const dominant = [...values]
    .map((v, i) => ({ key: CHEMISTRY_KEYS[i], value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((e) => ({ key: e.key, value: e.value }));

  // Residual vs previous
  const residual = prev ? residualChemistry(values, prev) : { inherited: [], strengthened: CHEMISTRY_KEYS.filter((k, i) => values[i] >= 25), reduced: [], introduced: CHEMISTRY_KEYS.filter((k, i) => values[i] >= 25) };

  // Purpose
  const purpose = describePurpose({
    role,
    slotIndex,
    climaxIndex,
    trackCount,
    inherited: residual.inherited,
    introduced: residual.introduced,
    strengthened: residual.strengthened,
    reduced: residual.reduced,
    prev,
    next,
    genome,
  });

  return {
    values,
    activation,
    intensity,
    zeroDistance,
    dominant,
    ...residual,
    purpose,
  };
}

// ── buildFullChemistryArc: produces chemistry for every track in one pass ──

export function buildFullChemistryArc({ genome, slots, climaxIndex, trackCount, endTarget }) {
  let prev = null;
  return slots.map((slot, i) => {
    const roleId = slot.roleId || slot.role;
    const roleDef = { id: roleId, intensity: ROLE_INTENSITY[roleId] ?? 0.5 };
    const result = composeChemistry({
      genome,
      role: roleDef,
      slotIndex: i,
      climaxIndex,
      trackCount,
      prev,
      next: null,
      endTarget,
    });
    prev = result.values;
    return result;
  });
}
