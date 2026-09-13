import {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_TAGLINES,
  BLEND_STEP,
  CLUSTER_FLAVORS,
  EMOTION_META,
  ENERGY_BANDS,
  GENRES,
  SUFFIXES,
  blendCentroids,
  classify,
  dominantEmotions,
  normalizeWeights,
} from "./promptEngine";
import { createProjectVocabulary } from "./titleVocabulary";
import { profileToGenome, buildFullChemistryArc, composeChemistry } from "./albumChemistry";
import { buildTempoTrajectory } from "./albumTempo";

// Bumped whenever the prompt/arc/bible generation changes. Persisted projects
// resolve through their own stored blueprint, so older snapshots stay stable;
// a mismatch surfaces an upgrade banner instead of silently rerolling.
export const ALBUM_ENGINE_VERSION = "album-engine-v2.6";

const ROLE_SUFFIX_POOLS = {
  opener: ["First Light", "Second Dawn", "Open Sky", "Warm Center"],
  body: ["Deep Room", "Inner Lane", "Velvet Cut", "Gold Room"],
  lift: ["Unexpected Turn", "Coiled Spring", "Jagged Edge", "Red Shift"],
  interlude: ["Blue Hour", "Silent Run", "Low Orbit", "Night Bloom"],
  climax: ["Voltage Peak", "Hard Truth", "Afterimage", "Cold Static"],
  descent: ["Last Signal", "Shadow Line", "Hollow Fast", "Unending"],
  closer: ["Still Water", "High Ground", "Silent Run", "Second Dawn"],
};

const SCENE_OPENINGS = [
  "Open on a single sound and let the room fade in around it.",
  "Begin small, as if entering the song from a distant doorway.",
  "Start mid-thought and pull the listener closer with the first phrase.",
  "Open on texture before shape; let the motif arrive like a half-remembered tune.",
  "Start with space and one object in it — build the rest as an answer to that object.",
  "Begin with the room itself: the air, the hum, the distance between notes.",
];

const ENTRY_FOCUSES = [
  "Let the first ten seconds be carried by a single element — drums, bass, or a lone pad — before the rest arrives.",
  "Bring the beat in first and let the melody step into the gap it leaves.",
  "Let a single chord bloom into the full palette before any rhythm commits.",
  "Enter on a rhythmic whisper and grow to a full front the moment the motif lands.",
  "Lead with the low end; let the upper layers arrive late and unannounced.",
  "Lead with a bowed, breath-like tone and let the machinery enter under it.",
];

const INTENSITY_WORDS = [
  { max: 0.4, word: "a hushed, open intensity" },
  { max: 0.56, word: "a quiet, restrained intensity" },
  { max: 0.71, word: "a steady, engaging intensity" },
  { max: 0.86, word: "a lifted, urgent intensity" },
  { max: 1.01, word: "an album-peak intensity" },
];

const ARC_ATTRS = [
  { key: "mean_energy", offset: 1 },
  { key: "mean_tension", offset: 1.5 },
  { key: "mean_complexity", offset: 1 },
];

export const TRACK_ROLES = [
  {
    id: "opener",
    label: "Opener",
    energy: 1,
    bpm: 0,
    intensity: 0.55,
    brief:
      "Open by inviting the listener into the album world with a strong hook and a clear, single statement of the central theme.",
  },
  {
    id: "body",
    label: "Body",
    energy: 0,
    bpm: 0,
    intensity: 0.62,
    brief:
      "Deepen the album's world; give this track its own angle on the central motif while staying inside the same mood range.",
  },
  {
    id: "lift",
    label: "Energy lift",
    energy: 1,
    bpm: 6,
    intensity: 0.78,
    brief:
      "Lift the room: a brighter groove and a more danceable push that snaps attention back to the album's pulse.",
  },
  {
    id: "interlude",
    label: "Interlude",
    energy: -2,
    bpm: -12,
    intensity: 0.3,
    brief:
      "A short, sparse interlude built from the album's motif or texture — a breath between the peaks, not a new idea.",
  },
  {
    id: "climax",
    label: "Climax",
    energy: 2,
    bpm: 4,
    intensity: 1,
    brief:
      "The album's peak: fullest arrangement, strongest hook, most complete emotional payoff — everything else points here.",
  },
  {
    id: "descent",
    label: "Descent",
    energy: -1,
    bpm: 0,
    intensity: 0.5,
    brief:
      "A deliberate comedown that keeps the mood but lets the tension bleed out, so the ending lands as a choice.",
  },
  {
    id: "closer",
    label: "Closer",
    energy: -2,
    bpm: -8,
    intensity: 0.45,
    brief:
      "Resolve the journey: reflective, warm, a memorable ending that returns to the album's opening thought.",
  },
];

const ROLE_BY_ID = Object.fromEntries(TRACK_ROLES.map((r) => [r.id, r]));

// ── P2.5 differentiated-behavior pools ──────────────────────────────────
// Each album gets one behavior sentence per sonic dimension per track, chosen
// with a stride that guarantees adjacency rarely repeats inside the pool.

const ARRANGEMENT_BEHAVIORS = [
  "Let the arrangement peel back to bare bones between sections, then rebuild on the motif.",
  "Layer one new element into each pass of the chorus so the track densifies without rushing.",
  "Play the whole track in a single long gravitating line; let sections ask and answer each other.",
  "Let the beat recede for the mid-section and return as a fuller, steadier version.",
  "Keep the arrangement additive from the first bar, trading boldness for an inexorable build.",
  "Build each section as a separate room the motif walks through, joined by a shared bridge.",
  "Keep it lean: no section adds more than three layers on top of the heart of the track.",
];

const RHYTHMIC_BEHAVIORS = [
  "Hold a hypnotic pulse and change texture, not tempo, when the track turns.",
  "Let the rhythm stop-start around the motif so the groove is felt in the silences.",
  "Push the groove forward with swung, ahead-of-the-beat percussion; let tension come from anticipation.",
  "Keep the kick unbroken and let everything else play against it in syncopation.",
  "Open with sparse hits and let the rhythm fill in as the soundscape widens.",
  "Use a rolling, free rhythm under a strict beat; treat rhythm as atmosphere first.",
  "Chop the groove for the second half and pull the motif over the gaps it leaves.",
];

const INSTRUMENTATION_PROMINENCE = [
  "Foreground the lead as a clear human voice; keep the pad low in the field.",
  "Let the bass lead the conversation and the melody listen in from a step back.",
  "Put a single texture (fuzz, tape, choir) slightly above everything else as the star.",
  "Keep percussion the loudest identity; instruments trade phrases around it.",
  "Star the harmonized middle voices; the top line stays gentle.",
  "Center the arrangement on a lone keyboard and treat the band as a halo.",
  "Make every element audible but give the arrangement one proud foreground sound.",
];

const HARMONIC_TENSION = [
  "Resolve the harmony generously; let it comfort rather than challenge.",
  "Stay primarily consonant with one sour note left in to keep it honest.",
  "Drift between two chords for the verses, then open a wider harmony for the release.",
  "Let a tense, unresolved chord hang into each section boundary.",
  "Push major and minor against each other; keep the resolution half-earned.",
  "Stay low and open in the same key, changing color, not key, across the track.",
  "Build the track around a pedal note with the harmony orbiting it.",
];

const ENTRY_BEHAVIORS = [
  "Enter on a single voice or instrument and let the first groove arrive a beat late.",
  "Start on a field of air and pulsing low end before any full phrase appears.",
  "Open on the hook itself, mid-phrase, as if always in motion.",
  "Begin with a distant, reversed sound that resolves into the track's first downbeat.",
  "Start with a whispered wall of noise and pull the piece out of it.",
  "Open with an isolated rhythmic cell the whole track grows from.",
  "Start on the second bar of the loop, as if already underway.",
];

const BREAKDOWN_BEHAVIORS = [
  "Break to near-silence once, then return with the motif intact.",
  "Let the mid-section strip to a lone rhythmic body before the theme returns.",
  "Use a false breakdown: almost empty, then jump straight back to full tension.",
  "Dissolve into texture for the breakdown and rebuild on the low end first.",
  "Cut the arrangement to just the bass and hold the space with motionless pads.",
  "Make the breakdown the emotional pivot: thinner, slower, then urgent again.",
  "Do away with overt breakdowns; keep continuous motion and let tension vary internally.",
];

const CLIMAX_BEHAVIORS = [
  "At the peak, add the fullest possible arrangement in one decisive step.",
  "Grow the climax over two final passes, adding density each time, then snap it back.",
  "Peak not with volume but with doubled parts and a wider harmonic spread.",
  "Climb to the climax on rhythmic fire; let it cut off into one held, open sound.",
  "Stagger the entrance of every layer so the peak is assembled in full view.",
  "Place the peak where the motif first doubles through harmony; the album's one release.",
  "Let the climax stay short but total: everything at once, then the room empties.",
];

const ENDING_BEHAVIORS = [
  "End with the motif played alone, falling to silence.",
  "Let the last chord ring out into the album's opening air.",
  "End mid-loop, fading as if the track keeps playing after you leave.",
  "Finish on a clean hook, then one resolved hit.",
  "End on a false button: the track appears to finish then returns for two quiet bars.",
  "Disappear into texture and let the closer start from that same air.",
  "Land the final resolution then hold a single instrument over the silence.",
];

const EMOTION_WORDS = {
  joy: "joy",
  trust: "trust",
  fear: "fear",
  surprise: "surprise",
  sadness: "sadness",
  disgust: "disgust",
  anger: "anger",
  anticipation: "anticipation",
};

function pickSpread(arr, i, salt, offset = 0) {
  const n = arr.length;
  const idx = (((i * 3 + salt * 5 + offset * 7) % n) + n) % n;
  return arr[idx];
}

const BEHAVIOR_POOLS = [
  ARRANGEMENT_BEHAVIORS,
  RHYTHMIC_BEHAVIORS,
  INSTRUMENTATION_PROMINENCE,
  HARMONIC_TENSION,
  ENTRY_BEHAVIORS,
  BREAKDOWN_BEHAVIORS,
  CLIMAX_BEHAVIORS,
  ENDING_BEHAVIORS,
];

function differentiateLine(slot, variantSeed) {
  const words = BEHAVIOR_POOLS.map((pool, offset) =>
    pickSpread(pool, slot.index, variantSeed, offset)
  );
  return words.join(" ");
}

function chemistryEmotionLine(chemistry, theme) {
  if (!chemistry) return "";
  const dominant = (chemistry.dominant || []).slice(0, 3).map((d) => EMOTION_WORDS[d.key] || d.key);
  const residualBits = [];
  if (chemistry.inherited && chemistry.inherited.length) {
    residualBits.push(`carries ${chemistry.inherited.slice(0, 3).join(", ")}`);
  }
  if (chemistry.strengthened && chemistry.strengthened.length) {
    residualBits.push(`magnifies ${chemistry.strengthened.slice(0, 3).join(", ")}`);
  }
  if (chemistry.reduced && chemistry.reduced.length) {
    residualBits.push(`lets ${chemistry.reduced.slice(0, 3).join(", ")} fade`);
  }
  if (chemistry.introduced && chemistry.introduced.length) {
    residualBits.push(`introduces ${chemistry.introduced.slice(0, 3).join(", ")}`);
  }
  const residualLine = residualBits.length ? ` It ${residualBits.join("; ")}.` : "";
  return (
    `Mood: ${dominant.join(", ")} at ${chemistry.activation} energy and ${chemistry.intensity}% of the album peak.` +
    (chemistry.purpose ? ` ${cap(chemistry.purpose)}` : "") +
    residualLine
  );
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function findGenre(id) {
  return GENRES.find((g) => g.id === id) || GENRES[0];
}

function bandIndexForEnergy(energy) {
  const idx = ENERGY_BANDS.findIndex((b) => energy < b.max);
  return idx === -1 ? ENERGY_BANDS.length - 1 : idx;
}

function emotionLabels(profile) {
  return EMOTION_META.map((meta) => ({ ...meta, value: profile[meta.key] ?? 0 }))
    .filter((meta) => meta.value >= 30)
    .sort((a, b) => b.value - a.value)
    .map((meta) => meta.word);
}

function baseBpmFor(genre, archetypeProfile) {
  if (genre.bpm) return genre.bpm;
  const e = archetypeProfile.mean_energy ?? 55;
  if (e >= 65) return 128;
  if (e >= 55) return 112;
  if (e >= 45) return 100;
  return 92;
}

function warmAnchor(templateIndex) {
  const sig = ALBUM_ARCHETYPES[templateIndex].signature_zscores || [];
  const positives = sig.filter(([, z]) => z > 0).slice(0, 3);
  const colors = EMOTION_META.filter((meta) =>
    positives.some(([key]) => key === meta.key)
  ).map((meta) => meta.terms.slice(0, 2).join(", "));
  return colors;
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function roleForArc({ index, total, roleMap }) {
  if (roleMap[index] && ROLE_BY_ID[roleMap[index]]) return ROLE_BY_ID[roleMap[index]];
  const known = Object.values(roleMap);
  if (known.length === total) return ROLE_BY_ID[known[index]] || ROLE_BY_ID.body;
  return ROLE_BY_ID.body;
}

export function buildAlbumArc({ trackCount, archetypeIndex, roleOverrides = {}, climaxPctOverride = null }) {
  const total = clamp(Number(trackCount) || 10, 4, 14);
  const archetype = ALBUM_ARCHETYPES[clamp(archetypeIndex, 0, ALBUM_ARCHETYPES.length - 1)];
  const pct =
    Number.isFinite(climaxPctOverride) && climaxPctOverride >= 0 && climaxPctOverride <= 100
      ? clamp(Number(climaxPctOverride), 20, 85)
      : clamp(Number(archetype.centroid_raw.climax_track_index_pct ?? 60), 20, 85);
  const climaxIdx = Math.round((pct / 100) * (total - 1));
  const roleMap = {};
  if (total >= 6) {
    const interludeIdx =
      climaxIdx < Math.floor(total / 2)
        ? Math.min(total - 2, Math.max(2, Math.floor((2 * total) / 3)))
        : Math.min(total - 3, Math.max(1, Math.floor(total / 3)));
    roleMap[interludeIdx] = "interlude";
  }
  if (climaxIdx - 1 >= 1) roleMap[climaxIdx - 1] = "lift";
  if (climaxIdx + 1 <= total - 2) roleMap[climaxIdx + 1] = "descent";
  roleMap[0] = "opener";
  roleMap[total - 1] = "closer";
  roleMap[climaxIdx] = "climax";
  Object.entries(roleOverrides).forEach(([idx, roleId]) => {
    if (ROLE_BY_ID[roleId] && idx >= 0 && idx < total) {
      roleMap[Number(idx)] = roleId;
    }
  });

  const slots = [];
  for (let i = 0; i < total; i += 1) {
    slots.push({ index: i, roleId: roleForArc({ index: i, total, roleMap }).id, climaxIndex: climaxIdx });
  }
  return { slots, climaxIndex: climaxIdx, climaxPct: pct };
}

export function buildAlbumBible({ albumName, genre, archetypeIndex, theme, trackCount, roleOverrides = {}, climaxPctOverride = null, seedBase = 0 }) {
  const genreDef = findGenre(genre);
  const idx = clamp(archetypeIndex, 0, ALBUM_ARCHETYPES.length - 1);
  const archetype = ALBUM_ARCHETYPES[idx];
  const profile = blendCentroids(normalizeWeights(ALBUM_ARCHETYPES.map((_, i) => (i === idx ? 1 : 0))));
  const c = classify(profile);
  const emotions = dominantEmotions(profile).map((meta) => meta.word);
  const arc = buildAlbumArc({ trackCount, archetypeIndex: idx, roleOverrides, climaxPctOverride });
  const centerBpm = baseBpmFor(genreDef, profile);
  const flavor = CLUSTER_FLAVORS[idx];
  const anchorColor = warmAnchor(idx);
  const vocab = createProjectVocabulary({
    theme,
    templateName: ARCHETYPE_NAMES[idx],
    genreLabel: genreDef.label,
    trackCount: arc.slots.length,
    seedBase,
  });
  const motifArtifact = vocab.artifacts?.[0] || null;
  const motifLine = flavor.extra.includes("film")
    ? `Let the motif ${motifArtifact ? `be ${motifArtifact}: ` : ""}thread through every track of this album like a recurring scene.`
    : `Keep one unforgettable motif alive across every track of this album${motifArtifact ? ` — ${motifArtifact}` : ""}. Repeat it like a memory, changing through phrasing, harmony, tone, and space.`;

  return {
    album: {
      name: albumName,
      genre: genreDef.id,
      archetypeIndex: idx,
      archetypeName: ARCHETYPE_NAMES[idx],
      theme: theme || "",
      trackCount: arc.slots.length,
    },
    anchor: {
      instrument: genreDef.instrument,
      craft: genreDef.craft,
      texture: genreDef.texture,
      motif: motifLine,
      flavor: flavor.extra,
      colors: anchorColor,
      moodRange: emotions,
      tagline: ARCHETYPE_TAGLINES[idx],
    },
    arc,
    roleOverrides,
    bpmCenter: centerBpm,
    profile,
    classification: c,
    climaxPosition: {
      pct: arc.climaxPct,
      slotIndex: arc.climaxIndex,
    },
    vocab,
    world: { families: vocab.world, motifArtifact },
  };
}

function intensityWord(intensity) {
  return (INTENSITY_WORDS.find((w) => intensity < w.max) || INTENSITY_WORDS[INTENSITY_WORDS.length - 1]).word;
}

export function slotBrief({ bible, slot, role, weights, theme, variantSeed = 0, note = "", chemistry = null, bpmOverride = null }) {
  const genreDef = findGenre(bible.album.genre);
  const cleanWeights = normalizeWeights(weights);
  const profile = blendCentroids(cleanWeights);
  const c = classify(profile);
  const baseBand = bandIndexForEnergy(profile.mean_energy ?? 50);
  const band = ENERGY_BANDS[clamp(baseBand + role.energy, 0, ENERGY_BANDS.length - 1)];
  const bpm = clamp(bpmOverride ?? (bible.bpmCenter + role.bpm), 70, 200);
  const emotions = dominantEmotions(profile).map((meta) => meta.word);
  const chemLine = chemistryEmotionLine(chemistry, theme);
  const emotionLine =
    chemLine ||
    (emotions.length > 0
      ? `Mood: ${emotions.join(", ")}. Carrying the album's overarching story${theme ? `: ${theme}` : ""}, delivered with ${intensityWord(role.intensity)}.`
      : `${theme ? `Thematic narrative: ${theme}.` : ""} `);
  const noteLine = note ? `Special direction for this track: ${note}.` : "";
  const spin = (slot.index + variantSeed) % 6;
  const sceneOpening = SCENE_OPENINGS[spin];
  const entryFocus = ENTRY_FOCUSES[(spin + 3) % 6];
  const differentiation = differentiateLine(slot, variantSeed);
  const identityLine = bible.anchor.tagline ? `${cap(bible.anchor.tagline).replace(/\.$/, "")}.` : "";

  const sentences = [
    `Track ${slot.index + 1} of ${bible.album.trackCount} — ${role.label.toLowerCase()}. ${cap(role.brief)}`,
    sceneOpening,
    `Instrumental ${band.tempo} ${band.density} ${genreDef.name} track with ${band.motion}.`,
    bible.anchor.instrument,
    bpm > 0 ? `Set the pulse at ${bpm} BPM and hold it steady without sounding metronomic.` : "",
    emotionLine,
    identityLine,
    entryFocus,
    bible.anchor.motif,
    bible.anchor.craft,
    `Texture: ${c.texture.join(", ")}; arrangement ${c.complexity.slice(0, 2).join(", ")}. ${bible.anchor.texture}`,
    ...c.structure.map((bit) => cap(`${bit}.`)),
    `Arrangement should ${c.climax}.`,
    differentiation,
    bible.anchor.flavor,
    noteLine,
    "Sound original and cinematic; avoid formulas. Leave silence as a tool.",
  ];

  const prompt = sentences.filter(Boolean).join(" ");
  const negative_prompt = Array.from(new Set([...genreDef.negatives, "no over-bright mix"])).join(", ");

  const title = bible.vocab
    ? bible.vocab.title(slot.index, variantSeed)
    : `${genreDef.family[slot.index % genreDef.family.length]} ${ROLE_SUFFIX_POOLS[role.id]?.[slot.index % 4] || SUFFIXES[slot.index % SUFFIXES.length]}`;

  return {
    index: slot.index,
    total: bible.album.trackCount,
    role: role.id,
    roleLabel: role.label,
    roleBrief: role.brief,
    intensity: role.intensity,
    bpm,
    title,
    prompt,
    negative_prompt,
    genre: genreDef.id,
    profile,
    blend: cleanWeights,
    dominantCluster: ALBUM_ARCHETYPES[bible.album.archetypeIndex].cluster_id,
    analysis: c,
    variantSeed,
    note,
    chemistry: chemistry || null,
  };
}

export function buildAlbumBlueprint({ albumName, genre, archetypeIndex, theme, trackCount, slotWeights = [], roleOverrides = {}, variantSeeds = {}, slotNotes = {}, climaxPctOverride = null, endingBias = null, seedBase = 0, tempoBehavior = "locked", tempoSeed = 0 }) {
  const bible = buildAlbumBible({ albumName, genre, archetypeIndex, theme, trackCount, roleOverrides, climaxPctOverride, seedBase });
  const oneHot = ALBUM_ARCHETYPES.map((_, i) => (i === bible.album.archetypeIndex ? 1 : 0));
  const endingIndex = Number.isInteger(endingBias) && endingBias >= 0 && endingBias <= ALBUM_ARCHETYPES.length - 1 ? endingBias : null;
  const genome = profileToGenome(bible.profile);
  const tempo = buildTempoTrajectory({
    baseBpm: bible.bpmCenter,
    genre: findGenre(bible.album.genre),
    trackCount: bible.arc.slots.length,
    behavior: tempoBehavior,
    seed: tempoSeed,
    climaxIndex: bible.arc.climaxIndex,
  });
  const chemistryArc = buildFullChemistryArc({
    genome,
    slots: bible.arc.slots,
    climaxIndex: bible.arc.climaxIndex,
    trackCount: bible.arc.slots.length,
    endTarget: genome,
  });
  const slots = bible.arc.slots.map((s, i) => {
    const role = ROLE_BY_ID[s.roleId];
    let weights = normalizeWeights(slotWeights[s.index] || oneHot);
    // endingBias nudges the last 1-2 tracks toward an ending coordinate without
    // rewriting the bible or forcing a hard one-to-one answer-archetype mapping.
    if (endingIndex !== null && s.index >= bible.album.trackCount - 2) {
      const pull = (s.index === bible.album.trackCount - 1 ? 0.4 : 0.22);
      weights = normalizeWeights(weights.map((w, i) => w * (1 - pull) + (i === endingIndex ? pull : 0)));
    }
    return slotBrief({
      bible,
      slot: s,
      role,
      weights,
      theme,
      variantSeed: variantSeeds[s.index] ?? 0,
      note: slotNotes[s.index] ?? "",
      chemistry: chemistryArc[i],
      bpmOverride: tempo[i],
    });
  });
  return { bible, slots, chemistry: chemistryArc, tempo, genome, tempoBehavior };
}

export function regenerateSlot(blueprint, slotIndex, { role = null, weights = null, theme = null, variantSeed = null, note = null } = {}) {
  const slot = blueprint.slots[slotIndex];
  if (!slot) throw new Error(`regenerateSlot: no slot ${slotIndex}`);
  const bible = blueprint.bible;
  const roleId = role && ROLE_BY_ID[role] ? role : slot.role;
  const roleDef = ROLE_BY_ID[roleId];
  const nextWeights = weights && Array.isArray(weights) ? normalizeWeights(weights) : slot.blend;
  let themeToUse = theme;
  if (themeToUse === null) themeToUse = bible.album.theme;

  // Recomputes chemistry for this slot only, seeded by the original upstream
  // snapshot so sibling tracks keep their inherited story.
  const chemistry = blueprint.chemistry
    ? composeChemistry({
        genome: blueprint.genome || profileToGenome(bible.profile),
        role: roleDef,
        slotIndex,
        climaxIndex: bible.arc.climaxIndex,
        trackCount: bible.album.trackCount,
        prev: blueprint.chemistry[slotIndex - 1]?.values || null,
        next: blueprint.chemistry[slotIndex + 1]?.values || null,
        endTarget: blueprint.genome || profileToGenome(bible.profile),
      })
    : null;

  return slotBrief({
    bible,
    slot: { index: slot.index, total: bible.album.trackCount },
    role: roleDef,
    weights: nextWeights,
    theme: themeToUse,
    variantSeed: variantSeed === null ? slot.variantSeed : variantSeed,
    note: note === null ? slot.note : note,
    chemistry,
    bpmOverride: blueprint.tempo?.[slotIndex] ?? null,
  });
}

function firstEmotion(slot) {
  return slot?.analysis?.emotions?.[0];
}

function energyMove(prev, slot) {
  if (!prev) return "begins the energy arc";
  const a = prev.analysis?.density || "balanced";
  const b = slot.analysis?.density || "balanced";
  if (a === b) return "holds its energy level";
  const order = ["sparse", "breathing", "full", "dense"];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  return ia < ib ? "steps energy up" : "lets energy settle";
}

/* Plain-language explanation of a track's role in the album.
 * `previous` / `next` are sibling slot objects from the same blueprint.
 */
export function explainSlot(slot, previous = null, next = null) {
  const from = firstEmotion(previous);
  const to = firstEmotion(slot);
  const prevBpm = previous?.bpm;
  const prevInt = previous?.intensity;

  const inherits = previous
    ? `Picks up ${from ? `the ${from} mood` : "the same mood"}${prevBpm ? ` at ${prevBpm} BPM` : ""} and keeps the album's shared palette and motif.`
    : "Opens the album: it establishes the palette, the central motif, and the emotional starting coordinate.";

  const changes = [
    `${cap(energyMove(previous, slot))} (${previous ? `${Math.round(prevInt * 100)}% → ${Math.round(slot.intensity * 100)}% intensity` : `opens at ${Math.round(slot.intensity * 100)}% intensity`}).`,
    prevBpm ? `Pulse moves ${prevBpm} → ${slot.bpm} BPM.` : `Sets a ${slot.bpm} BPM pulse.`,
    from && to && from !== to ? `Leads the mood from ${from} toward ${to}.` : from ? "Stays on the same emotional thread." : "",
  ].filter(Boolean).join(" ");

  const movesNext = next
    ? `Sets up Track ${next.index + 1}, which will move ${(next.roleLabel || "body").toLowerCase()} next.`
    : "Closes the album: resolves the journey and returns toward the opening colors.";

  return {
    job: `${slot.roleLabel} — ${slot.roleBrief || ""}`,
    inherits,
    changes,
    movesNext,
    emotionalDirection: slot.analysis?.emotions?.length
      ? `${slot.analysis.emotions.slice(0, 2).join(" → ")}${previous ? ` (from ${from || "the same thread"})` : " (opening coordinate)"}`
      : "no dominant emotion above threshold",
  };
}

/* Reshapes a blueprint into the data the Journey visualization draws from, so
 * the UI is a pure function of the same arc the engine drives. */
export function buildJourneyView(blueprint) {
  const slots = blueprint.slots.map((slot, i) => ({
    index: slot.index,
    title: slot.title,
    role: slot.role,
    roleLabel: slot.roleLabel,
    intensity: Math.round(slot.intensity * 100),
    bpm: slot.bpm,
    emotions: slot.analysis.emotions,
    chemistry: slot.chemistry
      ? {
          values: slot.chemistry.values,
          activation: slot.chemistry.activation,
          intensity: slot.chemistry.intensity,
          zeroDistance: slot.chemistry.zeroDistance,
          dominant: slot.chemistry.dominant,
          inherited: slot.chemistry.inherited,
          strengthened: slot.chemistry.strengthened,
          reduced: slot.chemistry.reduced,
          introduced: slot.chemistry.introduced,
          purpose: slot.chemistry.purpose,
        }
      : null,
  }));
  const climax = blueprint.bible.climaxPosition;
  const explanations = blueprint.slots.map((slot, i) =>
    explainSlot(slot, blueprint.slots[i - 1] || null, blueprint.slots[i + 1] || null)
  );
  return {
    trackCount: slots.length,
    climaxIndex: climax.slotIndex,
    climaxPct: climax.pct,
    slots,
    explanations,
    peakIntensity: Math.max(...slots.map((s) => s.intensity)),
    bpmRange: [
      Math.min(...slots.map((s) => s.bpm)),
      Math.max(...slots.map((s) => s.bpm)),
    ],
    tempo: blueprint.tempo ? [...blueprint.tempo] : slots.map((s) => s.bpm),
    tempoBehavior: blueprint.tempoBehavior || "locked",
  };
}

export function buildAlbumIngestPack(blueprint, { modelVersion = "V4.5", token = "" } = {}) {
  const slots = blueprint.slots.map((s, i) => ({
    token,
    audio_url: "",
    title: s.title,
    prompt: s.prompt,
    negative_prompt: s.negative_prompt,
    lyrics: blueprint.bible.album.theme
      ? `A ${blueprint.bible.album.theme} story in imagery and restraint.`
      : "",
    model_version: modelVersion,
    creation_date: new Date().toISOString().slice(0, 10),
    playlist_name: blueprint.bible.album.name,
    raw_metadata: {
      album: blueprint.bible.album.name,
      genre: s.genre,
      slot: i + 1,
      total: s.total,
      role: s.role,
      role_label: s.roleLabel,
      dominant_cluster: ARCHETYPE_NAMES[blueprint.bible.album.archetypeIndex],
      theme: blueprint.bible.album.theme || "",
      bpm: s.bpm,
      variant_seed: s.variantSeed,
      note: s.note || "",
      arc_climax_track: blueprint.bible.climaxPosition.slotIndex + 1,
    },
    order: i + 1,
  }));

  return {
    album: {
      name: blueprint.bible.album.name,
      genre: blueprint.bible.album.genre,
      archetype: blueprint.bible.album.archetypeName,
      theme: blueprint.bible.album.theme,
      track_count: slots.length,
      generated_at: new Date().toISOString(),
      notes: "Fill audio_url with the downloaded Suno file URL, then POST each object to /music/suno/ingest with playlist_name matching this album's playlist.",
    },
    tracks: slots,
  };
}

export function buildPasteSheet(blueprint) {
  const t = blueprint.bible.album;
  const header = [
    `ALBUM: ${t.name}`,
    `Archetype: ${t.archetypeName} | Genre: ${t.genre} | Theme: ${t.theme || "(none)"}`,
    `Tracks: ${blueprint.slots.length} | BPM center: ${blueprint.bible.bpmCenter} | Climax: track ${blueprint.bible.climaxPosition.slotIndex + 1}`,
    `Arc: ${blueprint.slots.map((s) => s.roleLabel.toLowerCase()).join(" → ")}`,
    "",
  ];
  const body = blueprint.slots.flatMap((s, i) => [
    `--- TRACK ${i + 1} | ${s.roleLabel.toUpperCase()} | ${s.title} | ${s.bpm} BPM ---`,
    s.prompt,
    "",
    `Negative: ${s.negative_prompt}`,
    "",
  ]);

  return [...header, "SPREADSHEET PASTE BLOCK: [title, prompt, negative_prompt, playlist_name]", ...body].join("\n");
}

export function buildAlbumExport(blueprint, options = {}) {
  return {
    ingest: buildAlbumIngestPack(blueprint, options),
    pasteSheet: buildPasteSheet(blueprint),
  };
}

export {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_TAGLINES,
  BLEND_STEP,
  GENRES,
};