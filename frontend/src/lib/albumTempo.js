// Tempo trajectory — the album decides its own movement inside genre bounds.
// BPM is no longer just a fixed center plus a role offset; the wizard picks an
// album-level tempo behavior and the engine shapes a coherent pulse story.

export const TEMPO_OPTIONS = [
  {
    id: "locked",
    label: "Locked / hypnotic",
    description: "One pulse holds the whole record — trance-like focus on the motif.",
  },
  {
    id: "rise",
    label: "Gradual rise",
    description: "The album slowly accelerates from a patient start to a driving finish.",
  },
  {
    id: "fall",
    label: "Gradual fall",
    description: "Starts hot then exhales down into a calm, long closer.",
  },
  {
    id: "wave",
    label: "Waves",
    description: "Pulse breathes up and down in two long swells across the record.",
  },
  {
    id: "peak-release",
    label: "Peak and release",
    description: "Builds to the climax track, then opens up and lets the ending land.",
  },
  {
    id: "dramatic-break",
    label: "Dramatic break",
    description: "Locks a steady center, breaks hard in the middle, spikes late.",
  },
  {
    id: "free-form",
    label: "Free-form",
    description: "The pulse wanders inside genre bounds, still recognizably one album.",
  },
];

const BOUNDS_PCT = 0.18; // up to ±18% from center, story-driven

function factorFor(behavior, i, n, climaxIndex, seed) {
  const t = n > 1 ? i / (n - 1) : 0;
  switch (behavior) {
    case "locked":
      return 0;
    case "rise":
      return t * 2 - 1; // −1 → +1
    case "fall":
      return (1 - t) * 2 - 1; // +1 → −1
    case "wave": {
      return Math.sin((i / Math.max(1, n)) * Math.PI * 2) * 0.7 + Math.sin((i / Math.max(1, n)) * Math.PI * 4) * 0.3;
    }
    case "peak-release": {
      const dist = Math.abs(i - climaxIndex) / Math.max(1, n - 1);
      const ramp = t * 2 - 1;
      const peak = Math.max(0, 1 - dist * 2) * 1.0;
      return clampP(ramp * 0.4 + peak - 0.3);
    }
    case "dramatic-break": {
      const dip = Math.exp(-Math.pow((i - n * 0.5) / (n * 0.16), 2)) * 1.0;
      const spike = Math.exp(-Math.pow((i - climaxIndex) / Math.max(2, n * 0.12), 2)) * 0.8;
      return clampP(spike - dip);
    }
    case "free-form": {
      // seeded pseudo-random walk that stays near the center
      let r = (seed * 2654435761) >>> 0;
      const points = [];
      for (let k = 0; k < n; k++) {
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        points.push((r / 4294967296) - 0.5);
      }
      // smooth with neighbors
      const smoothed = points.map((p, k) => {
        const l = points[k - 1] ?? p;
        const r2 = points[k + 1] ?? p;
        return (l + p + r2) / 3 * 2; // scale to ±~1
      });
      return clampP(smoothed[i] ?? 0);
    }
    default:
      return 0;
  }
}

function clampP(v) {
  return Math.min(1, Math.max(-1, v));
}

export function buildTempoTrajectory({ baseBpm, genre, trackCount, behavior = "locked", seed = 0, climaxIndex = null }) {
  const n = Math.max(4, Math.min(14, Number(trackCount) || 10));
  // A fixed genre tempo can never drift.
  if (genre?.bpm) {
    return Array.from({ length: n }, () => genre.bpm);
  }
  const span = Math.round(baseBpm * BOUNDS_PCT);
  const idx = climaxIndex ?? Math.round(n / 2);
  const deltas = Array.from({ length: n }, (_, i) => {
    const factor = factorFor(behavior, i, n, idx, seed);
    return clampBpm(Math.round((baseBpm + factor * span) / 5) * 5);
  });

  // Never break the very opening: track 1 stays near center unless rise/fall
  // explicitly ask otherwise — the story starts before the movement matters.
  return deltas;
}

function clampBpm(v) {
  return Math.min(210, Math.max(60, v));
}

export default buildTempoTrajectory;