import { ALBUM_ARCHETYPES } from "../data/albumArchetypes";

const FEATURE_KEYS = [
  "mean_joy",
  "mean_trust",
  "mean_fear",
  "mean_surprise",
  "mean_sadness",
  "mean_disgust",
  "mean_anger",
  "mean_anticipation",
  "mean_saturation",
  "mean_zero_distance",
  "mean_complexity",
  "mean_energy",
  "mean_tension",
  "mean_resolution",
  "mean_activation",
  "climax_track_index_pct",
  "emotional_variance_index",
  "structural_variance",
  "sonic_variance",
  "continuity_score",
];

const EMOTION_META = [
  { key: "mean_joy", word: "joy", terms: ["radiant", "luminous", "uplifting", "sun-warmed"] },
  { key: "mean_trust", word: "trust", terms: ["grounded", "reassuring", "centered", "warm"] },
  { key: "mean_fear", word: "fear", terms: ["shadowed", "uneasy", "creeping", "dread-touched"] },
  { key: "mean_surprise", word: "surprise", terms: ["unexpected", "jagged", "playful", "shape-shifting"] },
  { key: "mean_sadness", word: "sadness", terms: ["aching", "wistful", "longing", "rain-washed"] },
  { key: "mean_disgust", word: "disgust", terms: ["gritty", "caustic", "biting", "smoke-stained"] },
  { key: "mean_anger", word: "anger", terms: ["propulsive", "searing", "urgent", "clenched"] },
  { key: "mean_anticipation", word: "anticipation", terms: ["expectant", "breathless", "coiled", "about-to-turn"] },
];

const ENERGY_BANDS = [
  { max: 40, tempo: "slow, spacious", motion: "half-time swing with wide open space", density: "sparse" },
  { max: 55, tempo: "mid-tempo", motion: "steady rolling percussion and unhurried momentum", density: "breathing" },
  { max: 70, tempo: "club-tempo", motion: "tight rhythmic drive with a locked pocket", density: "full" },
  { max: 101, tempo: "high-velocity", motion: "urgent breakbeat energy with relentless drive", density: "dense" },
];

// Genre voices grounded in the library's own stored generation prompts
// (genre scan of all 88 unique prompts: trap 24, techno 20, dub 15, r&b 15,
//  ambient 12, hip-hop 9, dnb 7/174bpm/87bpm, electroswing 124, tribal house 128, ...)
const GENRES = [
  {
    id: "bass-electronic",
    label: "Bass Electronic",
    name: "bass-electronic",
    bpm: null,
    instrument:
      "Steady human pulse and club warmth. Blend soulful harmony, organic percussion, dub sub bass, and gentle motion.",
    craft:
      "Use loose microtiming, natural swing, varied velocity, ghost notes, late claps, imperfect hand percussion, and played-feeling fills.",
    texture: "Favor warm analog synths, rounded bass, dusty drums, tape texture, room air, and restrained stereo motion.",
    family: ["Analog Pulse", "Night Drive", "Velvet Signal", "Afterglow"],
    negatives: ["no guitars", "no vocals", "no over-bright mix", "no literal genre clich\u00e9s", "no cheap synth presets"],
  },
  {
    id: "dnb",
    label: "Drum & Bass",
    name: "drum-and-bass",
    bpm: 174,
    instrument:
      "Tight breakbeat engine, sub-driven bassline, and rolling atmospheric pads. DnB at double-time feel with half-time breathing room.",
    craft:
      "Program breaks with jagged micro-timing, syncopated snare rolls, ghost notes, and swung fills so it swings at 174.",
    texture: "Favor crisp transient drums, deep clean subs, bit-crushed textures, and wide stereo space.",
    family: ["Breakwater", "Fast Lane", "Static Bloom", "Vantage"],
    negatives: ["no guitars", "no vocals", "no muddy low end", "no half-speed boredom", "no cheesy synth leads"],
  },
  {
    id: "techno",
    label: "Techno",
    name: "techno",
    bpm: null,
    instrument:
      "Hypnotic four-on-the-floor techno with punishing kicks, warehouse reverb, and moving modular basslines.",
    craft:
      "Keep a relentless pulse, mutate the timbre bar by bar, and let a single motif evolve through filters and tension.",
    texture: "Favor raw machine-soul textures, metallic percussion, rumbling low end, and clean peak-time drive.",
    family: ["Monolith", "Control Room", "High Voltage", "Terminal"],
    negatives: ["no guitars", "no vocals", "no noodly synth solos", "no flat kicks", "no over-slick mastering"],
  },
  {
    id: "trap",
    label: "Trap",
    name: "trap",
    bpm: 140,
    instrument:
      "Side-chained supersaw pads, crisp snare on the backbeat, heavy 808 sub, and syncopated hi-hats with triplet rolls.",
    craft:
      "Build dark, suspenseful verses that snap into a hard-hitting drop; keep the beat sparse so the 808 hits land.",
    texture: "Favor glossy synth layers, airy reverb on percussion, deep sub weight, and cinematic pitch-bent accents.",
    family: ["Street Glow", "Gold Room", "Open Window", "Midnight Club"],
    negatives: ["no vocals", "no cheesy mumble trap ad-libs", "no muddy 808", "no over-compressed mix"],
  },
  {
    id: "r-b-trap",
    label: "R&B / Trap soul",
    name: "instrumental R&B trap",
    bpm: null,
    instrument:
      "Smooth R&B harmony with tribal percussion and trap drums: pillow-soft chords, rolling 808s, and warm polyphony.",
    craft:
      "Let the chord changes breathe; alternate half-time soul passages with a locked trap pocket.",
    texture: "Favor silky analog pads, tape saturation, soft keys, muted percussion, and spacious vocal-free textures.",
    family: ["Velvet Room", "Club Prayer", "Slow Burn", "After Hours"],
    negatives: ["no vocals", "no harsh treble", "no jarring drops", "no thin chords"],
  },
  {
    id: "ambient",
    label: "Ambient / Cinematic",
    name: "ambient",
    bpm: null,
    instrument:
      "Patient ambient soundscape built from evolving synth pads, field textures, and slow tonal movement.",
    craft:
      "Avoid percussion unless it serves momentum; let harmony and space tell the story in long, unforced phrases.",
    texture: "Favor deep reverbs, granular washes, subtle movement in the dark, and wide cinematic depth.",
    family: ["Shadow Lift", "Quiet Hours", "Blue Hour", "Low Orbit"],
    negatives: ["no harsh treble", "no loud drums", "no busy arrangement", "no popcorn synths"],
  },
  {
    id: "electroswing",
    label: "Electroswing",
    name: "electroswing",
    bpm: 124,
    instrument:
      "High-tempo syncopated groove with staccato brass stabs, walking synth bass, swing drums, and a vintage dance floor spirit.",
    craft:
      "Keep the swing tight: dotted rhythms, rim-shot accents, and horn stabs that snap against a driving bassline.",
    texture: "Favor brassy bite, vinyl dust, upright-bass warmth, and modern club energy fused to 1940s chic.",
    family: ["Speakeasy", "Silver Spoon", "Marble Kiss", "Parlor"],
    negatives: ["no guitars", "no opera vocals", "no muddy upright bass", "no half-hearted swing"],
  },
  {
    id: "world-fusion",
    label: "World Fusion / Tribal House",
    name: "world fusion tribal house",
    bpm: 128,
    instrument:
      "Driving percussion ensemble of djembe, congas, and shakers layered with deep house bass and exotic melodic colors.",
    craft:
      "Anchor a steady club pulse under live-feeling hand percussion; keep melody modal and warm.",
    texture: "Favor organic drums, wooden tones, airy flutes, and a wide, festival-open soundstage.",
    family: ["Tidal", "Market Street", "Migrations", "Horizon"],
    negatives: ["no guitars", "no chants", "no cheesy world music clich\u00e9s", "no over-busy percussion"],
  },
  {
    id: "nu-jazz",
    label: "Nu-Jazz / Fusion",
    name: "nu-jazz and funk fusion",
    bpm: 105,
    instrument:
      "Prominent saxophone lead with frequent vibrato and grace notes over a funky electric bass and crisp hip-hop drums.",
    craft:
      "Trade between horn lead and rhythm-section groove; keep solos melodic, never aimless.",
    texture: "Favor warm brass, punchy electric bass, laid-back drums, and smoky room ambience.",
    family: ["Gold Street", "Night Bloom", "Corner Club", "Wavelength"],
    negatives: ["no vocals", "no frantic saxophone", "no over-distorted keys", "no stiff drums"],
  },
  {
    id: "hip-hop",
    label: "Hip-Hop / Boom Bap",
    name: "boombap hip-hop",
    bpm: 90,
    instrument:
      "Gritty boom-bap with dusty sampled drums, thick warm bass, and soulful melodic samples arranged thoughtfully.",
    craft:
      "Let the break be the identity: head-nod swing, real-feeling funk, and small variations between bars.",
    texture: "Favor vinyl crackle, tape hiss, warm filters, and a smoky underground soundstage.",
    family: ["Corner Store", "Late Tape", "Golden Hour", "Nightcap"],
    negatives: ["no vocals", "no trap hi-hats", "no compressed square", "no brickwalled mastering"],
  },
];

const CLUSTER_FLAVORS = [
  {
    extra: "Let harmonic colors bloom and resolve. Everything should feel settled, centered, and quietly radiant.",
  },
  {
    extra: "Make sudden turns and harsh contrasts feel intentional. The piece should jolt without losing its spine.",
  },
  {
    extra: "Let emptiness breathe. Sorrow should live in the space between the notes, not in overstatement.",
  },
  {
    extra: "Each section should feel like a new scene in a film. Keep a thread running so it never shatters.",
  },
  {
    extra: "Create steep arcs from near-silence to full spectacle, then pull the floor away when it feels safe.",
  },
];

const ARCHETYPE_NAMES = ["Warm Resolution", "Harsh Voltage", "Quiet Melancholy", "Restless Collage", "Volatile Cinema"];
const BLEND_STEP = 5;
const ARCHETYPE_TAGLINES = [
  "resolved, trusting, warmly radiant — Kind of Blue territory",
  "surprising, angry, dense — Slayer/Sunbather energy",
  "melancholic, sparse, low-energy — Kid A/Blonde sorrow",
  "varied, shape-shifting, loosely bound — Ziggy/BRAT collage",
  "volatile, saturated, driven — Nevermind/Dark Side arcs",
];

const SUFFIXES = ["First Light", "Blue Hour", "Deep Room", "Last Signal", "Velvet Cut", "Night Bloom", "Open Sky", "Low Orbit", "Inner Lane", "Cold Static", "Gold Room", "Silent Run", "Afterimage", "Second Dawn"];

const EMOTION_SUFFIX_MAP = {
  joy: ["First Light", "Second Dawn", "Open Sky"],
  trust: ["Warm Center", "High Ground", "Still Water"],
  fear: ["Low Orbit", "Cold Static", "Shadow Line"],
  surprise: ["Jagged Edge", "Unexpected Turn", "Hollow Fast"],
  sadness: ["Blue Hour", "Last Signal", "Night Bloom"],
  disgust: ["Smoke Trail", "Bitter Thread", "Rust Line"],
  anger: ["Red Shift", "Hard Truth", "Voltage Peak"],
  anticipation: ["Coiled Spring", "Inner Lane", "Before The Drop"],
};

export function featureVector(centroidRaw) {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, centroidRaw[key] ?? 0]));
}

export function blendCentroids(weights) {
  const profile = {};
  for (const key of FEATURE_KEYS) {
    profile[key] = weights.reduce((sum, weight, i) => sum + weight * (ALBUM_ARCHETYPES[i].centroid_raw[key] ?? 0), 0);
  }
  return profile;
}

export function normalizeWeights(weights) {
  const cleaned = weights.map((w) =>
    Number.isFinite(Number(w)) && Number(w) >= 0 ? Number(w) : 0
  );
  const total = cleaned.reduce((a, b) => a + b, 0);
  if (total <= 0) return ALBUM_ARCHETYPES.map(() => 1 / ALBUM_ARCHETYPES.length);
  return cleaned.map((w) => w / total);
}

export function dominantEmotions(profile, limit = 3) {
  return EMOTION_META.map((meta) => ({ ...meta, value: profile[meta.key] ?? 0 }))
    .filter((meta) => meta.value >= 30)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function classify(profile) {
  const peak = (profile.climax_track_index_pct ?? 50) / 100;
  const climax =
    peak <= 0.4
      ? "build to a payoff in the first act, then let the energy relax in phases"
      : peak <= 0.7
        ? "climb to a clear center-piece peak, then ride a long, deliberate descent"
        : "be a slow burner: let the peak arrive close to the end and make every early bar a step toward it";

  const structureBits = [];
  if (profile.sonic_variance >= 60) structureBits.push("let the sonic palette transform from section to section");
  if (profile.structural_variance >= 60) structureBits.push("make the arrangement unpredictable, with turns the ear cannot pre-map");
  if (profile.continuity_score >= 75) structureBits.push("keep a seamless, movie-like continuity so the track feels like one long scene");
  if (profile.emotional_variance_index >= 8) structureBits.push("swing between wide emotional states within the same track");
  if (profile.mean_tension >= 58) structureBits.push("keep a coiled, unresolved tension under the surface");
  if (profile.mean_resolution >= 60) structureBits.push("resolve into a settled, open cadence rather than hanging");

  const textureWords = [];
  if (profile.mean_saturation <= 45) textureWords.push("airy", "restrained", "dusty");
  else if (profile.mean_saturation >= 70) textureWords.push("lush", "full-spectrum", "saturated");
  else textureWords.push("balanced", "organic", "warm");

  const complexityWords = [];
  if (profile.mean_complexity <= 45) complexityWords.push("minimal", "centered on one clear motif");
  else if (profile.mean_complexity >= 65) complexityWords.push("layered", "polyrhythmic", "deeply detailed");
  else complexityWords.push("interlocking", "nuanced");

  const band = ENERGY_BANDS.find((b) => profile.mean_energy < b.max) || ENERGY_BANDS[ENERGY_BANDS.length - 1];
  const emotionWords = dominantEmotions(profile).flatMap((meta) => meta.terms);

  return {
    energy: band.tempo,
    motion: band.motion,
    density: band.density,
    emotions: dominantEmotions(profile).map((meta) => meta.word),
    emotionWords,
    texture: textureWords,
    complexity: complexityWords,
    structure: structureBits,
    climax,
  };
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function findGenre(id) {
  return GENRES.find((g) => g.id === id) || GENRES[0];
}

function suffixFor(slot, emotions) {
  const key = Object.keys(EMOTION_SUFFIX_MAP).find((k) => emotions.includes(k));
  const pool = key ? EMOTION_SUFFIX_MAP[key] : SUFFIXES;
  return pool[slot.index % pool.length];
}

function titleFor(slot, c, genre) {
  const family = genre.family[slot.index % genre.family.length];
  return `${family} ${suffixFor(slot, c.emotions)}`;
}

export function synthesizePrompt({ genre = "bass-electronic", weights, slot = { index: 0, total: 10 }, theme = "" }) {
  const cleanWeights = normalizeWeights(weights);
  const profile = blendCentroids(cleanWeights);
  const genreDef = findGenre(genre);

  const dominantIndex = cleanWeights.indexOf(Math.max(...cleanWeights));
  const flavor = CLUSTER_FLAVORS[dominantIndex];
  const c = classify(profile);
  const emotionLine =
    c.emotions.length > 0
      ? `Mood: ${c.emotions.join(", ")}${theme ? `, carrying the overarching story: ${theme}` : ""}.`
      : `${theme ? `Thematic narrative: ${theme}.` : ""}`;

  const bpmLine = genreDef.bpm
    ? `Set the pulse at ${genreDef.bpm} BPM and hold it steady without sounding metronomic.`
    : "";
  const motifLine = flavor.extra.includes("film")
    ? "Let a central motif thread through every section." 
    : "Center everything on one unforgettable motif. Repeat it like a memory, changing through phrasing, harmony, tone, and space.";

  const sentences = [
    `Instrumental ${c.energy} ${c.density} ${genreDef.name} track with ${c.motion}.`,
    genreDef.instrument,
    bpmLine,
    emotionLine,
    motifLine,
    genreDef.craft,
    `Texture: ${c.texture.join(", ")}; arrangement ${c.complexity.slice(0, 2).join(", ")}. ${genreDef.texture}`,
    ...c.structure.map((bit) => cap(`${bit}.`)),
    `Arrangement should ${c.climax}.`,
    flavor.extra,
    "Sound original and cinematic; avoid formulas. Leave silence as a tool.",
  ];

  const prompt = sentences.filter(Boolean).join(" ");

  const negative_prompt = Array.from(new Set([...genreDef.negatives, "no over-bright mix"])).join(", ");

  const title = titleFor(slot, c, genreDef);

  return {
    prompt,
    negative_prompt,
    title,
    genre: genreDef.id,
    profile,
    blend: cleanWeights,
    dominantCluster: ALBUM_ARCHETYPES[dominantIndex].cluster_id,
    dominantClusterName: ARCHETYPE_NAMES[dominantIndex],
    analysis: c,
  };
}

export function buildIngestPack({ albumName, genre, theme, weightsBySlot, modelVersion = "V4.5", token = "" }) {
  const slots = weightsBySlot.map((weights, index) => {
    const result = synthesizePrompt({
      genre,
      weights,
      slot: { index, total: weightsBySlot.length },
      theme,
    });
    return {
      token,
      audio_url: "",
      title: result.title,
      prompt: result.prompt,
      negative_prompt: result.negative_prompt,
      lyrics: theme ? `A ${theme} story in imagery and restraint.` : "",
      model_version: modelVersion,
      creation_date: new Date().toISOString().slice(0, 10),
      playlist_name: albumName,
      raw_metadata: {
        album: albumName,
        genre: result.genre,
        slot: index + 1,
        total: weightsBySlot.length,
        dominant_cluster: result.dominantClusterName,
        theme: theme || "",
      },
      order: index + 1,
    };
  });

  return {
    album: {
      name: albumName,
      genre,
      theme,
      track_count: slots.length,
      generated_at: new Date().toISOString(),
      notes: "Fill audio_url with the downloaded Suno file URL, then POST each object to /music/suno/ingest with playlist_name matching this album's playlist.",
    },
    tracks: slots,
  };
}

export {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_TAGLINES,
  BLEND_STEP,
  CLUSTER_FLAVORS,
  EMOTION_META,
  ENERGY_BANDS,
  GENRES,
  SUFFIXES,
};