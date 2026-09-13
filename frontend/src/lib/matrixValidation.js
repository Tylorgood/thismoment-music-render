import { CHEMISTRY_KEYS, profileToGenome } from "./albumChemistry";

const BOILERPLATE = "Sound original and cinematic; avoid formulas. Leave silence as a tool.";

export const SHARED_DNA_BAND = { passLo: 25, passHi: 35, warnLo: 20, warnHi: 40 };
// Full-text Jaccard between two prompts lands at 0.75–0.88 on healthy albums
// because shared DNA, role briefs and structure bits dominate the token sets.
// So similarity is measured on *identity vocabulary* only: tokens that appear
// in at most IDENTITY_MAX_DF_FRACTION of the album's prompts. Same-family
// tracks on healthy albums top out around 0.65 identity overlap; accidental
// duplication pushes it well above.
export const SIMILARITY_THRESHOLDS = { warn: 0.7, fail: 0.85 };
export const IDENTITY_MAX_DF_FRACTION = 0.3;
export const CHEMISTRY_MAD = { pass: 12, warn: 20 };
export const ZERO_DISTANCE = { pass: 55, warn: 80 };

function wordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

function tokenize(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return inter / union;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

function worstOf(levels) {
  const order = { pass: 0, warn: 1, fail: 2 };
  return levels.reduce((w, l) => (order[l] > order[w] ? l : w), "pass");
}

export function sharedSegments(bible) {
  return [bible?.anchor?.instrument, bible?.anchor?.motif, bible?.anchor?.craft, bible?.anchor?.texture, bible?.anchor?.flavor, bible?.anchor?.tagline, BOILERPLATE];
}

export function validateSharedDNA({ bible, slots }) {
  const segments = sharedSegments(bible).filter(Boolean);
  const sharedWords = segments.map(wordCount).reduce((a, b) => a + b, 0);
  const perSlot = slots.map((slot) => {
    const total = wordCount(slot.prompt);
    return { index: slot.index, total, shared: sharedWords, ratio: Math.round((sharedWords / total) * 1000) / 10 };
  });
  const albumMean = mean(perSlot.map((p) => p.ratio));
  const { passLo, passHi, warnLo, warnHi } = SHARED_DNA_BAND;
  let level = "pass";
  if (albumMean < passLo || albumMean > passHi) level = "warn";
  if (albumMean < warnLo || albumMean > warnHi) level = "fail";
  return {
    level,
    albumMean: Math.round(albumMean * 10) / 10,
    min: Math.min(...perSlot.map((p) => p.ratio)),
    max: Math.max(...perSlot.map((p) => p.ratio)),
    perSlot,
    detail: `Album mean ${Math.round(albumMean * 10) / 10}% (target ${passLo}%–${passHi}%)`,
  };
}

export function identityTokens(slots) {
  const tokens = slots.map((s) => tokenize(s.prompt));
  const maxDf = Math.max(1, Math.round(slots.length * IDENTITY_MAX_DF_FRACTION));
  const df = {};
  tokens.forEach((t) => {
    for (const w of t) df[w] = (df[w] || 0) + 1;
  });
  return tokens.map((t) => {
    const id = new Set();
    for (const w of t) if (df[w] <= maxDf) id.add(w);
    return id;
  });
}

export function validatePromptSimilarity(slots) {
  if (slots.length < 2) {
    return { level: "pass", maxJaccard: 0, worstPair: null, identitySizes: [], detail: "Only one track; nothing to compare" };
  }
  const identity = identityTokens(slots);
  let maxJaccard = 0;
  let worstPair = null;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      // A track whose every token is constant across the album has no identity
      // vocabulary and is by definition too similar to its neighbors.
      const sim = !identity[i].size && !identity[j].size ? 1 : !identity[i].size || !identity[j].size ? 1 : jaccard(identity[i], identity[j]);
      if (sim > maxJaccard) {
        maxJaccard = sim;
        worstPair = [i, j];
      }
    }
  }
  const { warn: warnAt, fail: failAt } = SIMILARITY_THRESHOLDS;
  let level = "pass";
  if (maxJaccard >= warnAt) level = "warn";
  if (maxJaccard >= failAt) level = "fail";
  return {
    level,
    maxJaccard: Math.round(maxJaccard * 1000) / 1000,
    worstPair,
    identitySizes: identity.map((s) => s.size),
    detail: worstPair
      ? `Most similar tracks: ${worstPair[0] + 1} & ${worstPair[1] + 1} (${Math.round(maxJaccard * 100)}% identity-vocabulary overlap)`
      : "No overlapping prompt pairs",
  };
}

export function validateChemistryOnTarget({ slots, genome }) {
  const started = slots.filter((s) => Array.isArray(s.chemistry?.values) && s.chemistry.values.length === CHEMISTRY_KEYS.length);
  if (!started.length) {
    return { level: "fail", mad: null, meanZeroDistance: null, minZeroDistance: null, maxZeroDistance: null, detail: "No slot chemistry data to validate" };
  }
  const meanValues = CHEMISTRY_KEYS.map((_, i) => mean(started.map((s) => s.chemistry.values[i])));
  const mad = mean(meanValues.map((v, i) => Math.abs(v - genome[i])));
  const zeroDistances = started.map((s) => s.chemistry.zeroDistance);
  const meanZD = mean(zeroDistances);
  let level = "pass";
  if (mad > CHEMISTRY_MAD.pass || meanZD > ZERO_DISTANCE.pass) level = "warn";
  if (mad > CHEMISTRY_MAD.warn || meanZD > ZERO_DISTANCE.warn) level = "fail";
  return {
    level,
    mad: Math.round(mad * 10) / 10,
    meanZeroDistance: Math.round(meanZD * 10) / 10,
    minZeroDistance: Math.min(...zeroDistances),
    maxZeroDistance: Math.max(...zeroDistances),
    detail: `Chemistry vs album genome: mean abs deviation ${Math.round(mad * 10) / 10}, mean ZERO distance ${Math.round(meanZD * 10) / 10}`,
  };
}

export function validateArcFidelity({ slots, climaxIndex, tempo = [], tempoBehavior = "locked" }) {
  const intensities = slots.map((s) => s.intensity);
  const peakIdx = intensities.indexOf(Math.max(...intensities));
  const checks = [];
  const peakAtClimax = peakIdx === climaxIndex || Math.abs(intensities[peakIdx] - intensities[climaxIndex]) < 0.001;
  checks.push({ ok: peakAtClimax, label: `Peak intensity lands on climax track ${climaxIndex + 1}` });
  if (!peakAtClimax) checks[checks.length - 1].actual = `peak on track ${peakIdx + 1}`;

  const last = slots[slots.length - 1];
  const endingBelowPeak = last.intensity < intensities[climaxIndex];
  checks.push({ ok: endingBelowPeak, label: "Ending resolves below the peak" });
  if (!endingBelowPeak) checks[checks.length - 1].actual = `ending at ${last.intensity}`;

  const bpms = tempo.length === slots.length ? tempo : slots.map((s) => s.bpm);
  let tempoOk = true;
  let tempoLabel = `BPM follows "${tempoBehavior}" shape`;
  if (tempoBehavior === "locked") {
    tempoOk = new Set(bpms).size === 1;
  } else if (tempoBehavior === "rise") {
    tempoOk = bpms.every((b, i) => i === 0 || b >= bpms[i - 1] - 1);
  } else if (tempoBehavior === "fall") {
    tempoOk = bpms.every((b, i) => i === 0 || b <= bpms[i - 1] + 1);
  } else if (tempoBehavior === "peak-release") {
    tempoOk = bpms[climaxIndex] === Math.max(...bpms) || Math.abs(bpms[climaxIndex] - Math.max(...bpms)) <= 5;
  }
  checks.push({ ok: tempoOk, label: tempoLabel });
  if (!tempoOk) checks[checks.length - 1].actual = bpms.join(",");

  const level = worstOf(checks.map((c) => (c.ok ? "pass" : "warn")));
  return { level, checks, detail: `${checks.filter((c) => c.ok).length}/${checks.length} arc checks hold` };
}

export function validateIdentityFields(bible) {
  const fields = {
    tagline: !!(bible?.anchor?.tagline || "").trim(),
    moodRange: Array.isArray(bible?.anchor?.moodRange) && bible.anchor.moodRange.length > 0,
    colors: Array.isArray(bible?.anchor?.colors) && bible.anchor.colors.length > 0,
  };
  const missing = Object.entries(fields).filter(([, ok]) => !ok).map(([k]) => k);
  return {
    level: missing.length ? "warn" : "pass",
    fields,
    detail: missing.length ? `Identity fields unused: ${missing.join(", ")}` : "Identity fields (tagline, mood range, palette) populated",
  };
}

export function validateMatrix(blueprint) {
  if (!blueprint || !blueprint.slots || !blueprint.bible) {
    return { level: "fail", score: 0, rules: {}, metrics: {}, detail: "No blueprint to validate" };
  }
  const genome = blueprint.genome || profileToGenome(blueprint.bible.profile);
  const rules = {
    sharedDNA: validateSharedDNA({ bible: blueprint.bible, slots: blueprint.slots }),
    promptSimilarity: validatePromptSimilarity(blueprint.slots),
    chemistryOnTarget: validateChemistryOnTarget({ slots: blueprint.slots, genome }),
    arcFidelity: validateArcFidelity({
      slots: blueprint.slots,
      climaxIndex: blueprint.bible.climaxPosition?.slotIndex ?? 0,
      tempo: blueprint.tempo,
      tempoBehavior: blueprint.tempoBehavior,
    }),
    identityFields: validateIdentityFields(blueprint.bible),
  };
  const level = worstOf(Object.values(rules).map((r) => r.level));
  const failures = Object.entries(rules).filter(([, r]) => r.level === "fail").map(([k]) => k);
  const score = Math.round(100 - failures.length * 12);
  return {
    level,
    score: Math.max(0, score),
    rules,
    metrics: {
      sharedDNA: rules.sharedDNA.albumMean,
      maxIdentityOverlap: rules.promptSimilarity.maxJaccard,
      chemMad: rules.chemistryOnTarget.mad,
      meanZeroDistance: rules.chemistryOnTarget.meanZeroDistance,
    },
    detail: failures.length ? `Matrix checks failed: ${failures.join(", ")}` : level === "warn" ? "Matrix has warnings; album is usable" : "Matrix passes all checks",
  };
}

export default validateMatrix;