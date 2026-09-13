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
      motif: flavor.extra.includes("film")
        ? "Let a central motif thread through every track of this album."
        : "Keep one unforgettable motif alive across every track of this album. Repeat it like a memory, changing through phrasing, harmony, tone, and space.",
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
  };
}

function intensityWord(intensity) {
  return (INTENSITY_WORDS.find((w) => intensity < w.max) || INTENSITY_WORDS[INTENSITY_WORDS.length - 1]).word;
}

export function slotBrief({ bible, slot, role, weights, theme, variantSeed = 0, note = "" }) {
  const genreDef = findGenre(bible.album.genre);
  const cleanWeights = normalizeWeights(weights);
  const profile = blendCentroids(cleanWeights);
  const c = classify(profile);
  const baseBand = bandIndexForEnergy(profile.mean_energy ?? 50);
  const band = ENERGY_BANDS[clamp(baseBand + role.energy, 0, ENERGY_BANDS.length - 1)];
  const bpm = clamp(bible.bpmCenter + role.bpm, 70, 200);
  const emotions = dominantEmotions(profile).map((meta) => meta.word);
  const emotionLine =
    emotions.length > 0
      ? `Mood: ${emotions.join(", ")}. Carrying the album's overarching story${theme ? `: ${theme}` : ""}, delivered with ${intensityWord(role.intensity)}.`
      : `${theme ? `Thematic narrative: ${theme}.` : ""} `;
  const noteLine = note ? `Special direction for this track: ${note}.` : "";
  const spin = (slot.index + variantSeed) % 6;
  const sceneOpening = SCENE_OPENINGS[spin];
  const entryFocus = ENTRY_FOCUSES[(spin + 3) % 6];

  const sentences = [
    `Track ${slot.index + 1} of ${bible.album.trackCount} — ${role.label.toLowerCase()}. ${cap(role.brief)}`,
    sceneOpening,
    `Instrumental ${band.tempo} ${band.density} ${genreDef.name} track with ${band.motion}.`,
    bible.anchor.instrument,
    bpm > 0 ? `Set the pulse at ${bpm} BPM and hold it steady without sounding metronomic.` : "",
    emotionLine,
    entryFocus,
    bible.anchor.motif,
    bible.anchor.craft,
    `Texture: ${c.texture.join(", ")}; arrangement ${c.complexity.slice(0, 2).join(", ")}. ${bible.anchor.texture}`,
    ...c.structure.map((bit) => cap(`${bit}.`)),
    `Arrangement should ${c.climax}.`,
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
  };
}

export function buildAlbumBlueprint({ albumName, genre, archetypeIndex, theme, trackCount, slotWeights = [], roleOverrides = {}, variantSeeds = {}, slotNotes = {}, climaxPctOverride = null, endingBias = null, seedBase = 0 }) {
  const bible = buildAlbumBible({ albumName, genre, archetypeIndex, theme, trackCount, roleOverrides, climaxPctOverride, seedBase });
  const oneHot = ALBUM_ARCHETYPES.map((_, i) => (i === bible.album.archetypeIndex ? 1 : 0));
  const endingIndex = Number.isInteger(endingBias) && endingBias >= 0 && endingBias <= ALBUM_ARCHETYPES.length - 1 ? endingBias : null;
  const slots = bible.arc.slots.map((s) => {
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
    });
  });
  return { bible, slots };
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

  return slotBrief({
    bible,
    slot: { index: slot.index, total: bible.album.trackCount },
    role: roleDef,
    weights: nextWeights,
    theme: themeToUse,
    variantSeed: variantSeed === null ? slot.variantSeed : variantSeed,
    note: note === null ? slot.note : note,
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