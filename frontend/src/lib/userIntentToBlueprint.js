import { ALBUM_ARCHETYPES, normalizeWeights } from "./promptEngine";
import { hashString } from "./titleVocabulary";
import { TEMPO_OPTIONS } from "./albumTempo";

/*
 * Turns a plain-language wizard conversation into coordinates in the existing
 * Album DNA / blend / arc model.
 *
 * No answer is ever hard-wired to an archetype. "Beginning" / "ending" answers
 * only seed target blend coordinates that the arc is gently pulled toward, and
 * everything else lowers to the same five-archetype blend space the engine
 * already uses for slot prompts.
 */

// Lexicon derived from the engine's own descriptor vocab (ARCHETYPE_TAGLINES,
// CLUSTER_FLAVORS, EMOTION_META, ENERGY_BANDS). Each entry is a soft weight
// spread across the five archetypes; unknown words contribute 0 and just
// reduce confidence instead of changing the result.
const LEXICON = {
  // warm resolution
  trusting: [0.9, 0, 0.05, 0, 0.05],
  radiant: [0.85, 0, 0.1, 0, 0.05],
  warm: [0.7, 0, 0.15, 0.05, 0.1],
  resolved: [0.9, 0, 0.05, 0, 0.05],
  gentle: [0.6, 0.05, 0.25, 0.05, 0.05],
  calm: [0.6, 0, 0.3, 0, 0.1],
  serene: [0.85, 0, 0.1, 0, 0.05],
  glowing: [0.8, 0.05, 0.1, 0.05, 0],
  settled: [0.8, 0, 0.15, 0, 0.05],
  kind: [0.85, 0, 0.05, 0.05, 0.05],
  soft: [0.45, 0.05, 0.4, 0.05, 0.05],
  // harsh voltage
  angry: [0.05, 0.85, 0, 0.05, 0.05],
  harsh: [0.05, 0.8, 0, 0.05, 0.1],
  dense: [0.05, 0.6, 0.1, 0.15, 0.1],
  aggressive: [0, 0.85, 0, 0, 0.15],
  searing: [0, 0.85, 0, 0, 0.15],
  jolt: [0, 0.7, 0.05, 0.1, 0.15],
  violent: [0, 0.85, 0, 0, 0.15],
  loud: [0.05, 0.5, 0, 0.1, 0.35],
  brutal: [0, 0.85, 0, 0, 0.15],
  heavy: [0.1, 0.45, 0, 0.1, 0.35],
  // quiet melancholy
  melancholic: [0.1, 0.05, 0.75, 0.05, 0.05],
  sad: [0.05, 0, 0.85, 0.05, 0.05],
  sparse: [0.1, 0.05, 0.7, 0.1, 0.05],
  lonely: [0.05, 0, 0.85, 0.05, 0.05],
  intimate: [0.2, 0.05, 0.65, 0.05, 0.05],
  cold: [0, 0.2, 0.55, 0.15, 0.1],
  distant: [0.05, 0.15, 0.6, 0.15, 0.05],
  fading: [0.05, 0.1, 0.6, 0.15, 0.1],
  quiet: [0.35, 0.05, 0.5, 0.05, 0.05],
  emptiness: [0.05, 0.05, 0.75, 0.1, 0.05],
  slow: [0.3, 0.05, 0.5, 0.1, 0.05],
  sorrow: [0.05, 0, 0.85, 0, 0.1],
  // restless collage
  varied: [0.05, 0.15, 0.1, 0.6, 0.1],
  collage: [0.05, 0.15, 0.1, 0.65, 0.05],
  eclectic: [0, 0.15, 0.1, 0.65, 0.1],
  playful: [0.1, 0.2, 0.05, 0.55, 0.1],
  weird: [0, 0.2, 0.1, 0.55, 0.15],
  shape: [0.05, 0.15, 0.1, 0.6, 0.1],
  unpredictable: [0, 0.2, 0.05, 0.55, 0.2],
  scenes: [0.05, 0.15, 0.1, 0.6, 0.1],
  filmic: [0.05, 0.15, 0.1, 0.55, 0.15],
  restless: [0.05, 0.2, 0.1, 0.55, 0.1],
  restlessmotion: [0.05, 0.2, 0.1, 0.55, 0.1],
  // volatile cinema
  volatile: [0.05, 0.15, 0.05, 0.1, 0.65],
  driven: [0.05, 0.3, 0, 0.15, 0.5],
  cinematic: [0.05, 0.15, 0.05, 0.15, 0.6],
  dramatic: [0, 0.2, 0.05, 0.15, 0.6],
  explosive: [0, 0.25, 0, 0.1, 0.65],
  intense: [0.05, 0.25, 0.05, 0.15, 0.5],
  urgent: [0.05, 0.35, 0.05, 0.1, 0.45],
  grand: [0.1, 0.2, 0, 0.1, 0.6],
  spectacle: [0, 0.2, 0, 0.15, 0.65],
  rollercoaster: [0, 0.2, 0.05, 0.15, 0.6],
};

const INTENSITY_WORDS = {
  slow: [0.3, 0.05, 0.5, 0.1, 0.05],
  spacious: [0.25, 0.05, 0.55, 0.1, 0.05],
  midtempo: [0.35, 0.1, 0.25, 0.15, 0.15],
  rolling: [0.3, 0.15, 0.15, 0.2, 0.2],
  unlocking: [0.25, 0.2, 0.1, 0.2, 0.25],
  club: [0.2, 0.25, 0.05, 0.2, 0.3],
  urgent: [0.05, 0.35, 0.05, 0.1, 0.45],
  relentless: [0.05, 0.35, 0, 0.1, 0.5],
  breakbeat: [0.05, 0.3, 0.05, 0.15, 0.45],
};

export const BEGINNING_OPTIONS = [
  {
    id: "intimate",
    label: "Small and intimate",
    seed: [0.15, 0, 0.6, 0.1, 0.15],
    words: ["intimate", "small"],
  },
  {
    id: "heating",
    label: "Already in motion, mid-heat",
    seed: [0.05, 0.35, 0, 0.15, 0.45],
    words: ["midheat", "motion"],
  },
  {
    id: "cold",
    label: "Cold and distant",
    seed: [0, 0.15, 0.5, 0.2, 0.15],
    words: ["cold", "distant"],
  },
  {
    id: "warm",
    label: "Warm and settled",
    seed: [0.7, 0, 0.15, 0.05, 0.1],
    words: ["warm", "settled"],
  },
  {
    id: "coiled",
    label: "Tense, coiled",
    seed: [0.05, 0.2, 0.15, 0.15, 0.45],
    words: ["coiled", "tense"],
  },
];

export const ENDING_OPTIONS = [
  {
    id: "resolved",
    label: "Resolved, warm return",
    seed: [0.75, 0, 0.1, 0.05, 0.1],
    words: ["resolved", "warm"],
  },
  {
    id: "open",
    label: "Unresolved — it keeps turning",
    seed: [0.1, 0.2, 0.3, 0.3, 0.1],
    words: ["unresolved", "turning"],
  },
  {
    id: "catharsis",
    label: "Big explosion, then silence",
    seed: [0.05, 0.3, 0.15, 0.1, 0.4],
    words: ["explosion", "silence"],
  },
  {
    id: "fade",
    label: "Fade to nothing",
    seed: [0.15, 0.1, 0.55, 0.1, 0.1],
    words: ["fading", "nothing"],
  },
];

export const JOURNEY_OPTIONS = [
  { id: "steady", label: "Steady lift", climaxPct: 50, contour: "steadily rising tension and clean resolution" },
  { id: "slow-burn", label: "Slow burn to a huge late peak", climaxPct: 72, contour: "a long preamble that detonates near the end" },
  { id: "early", label: "Peak early, long exhale", climaxPct: 28, contour: "an early crest followed by a long, careful descent" },
  { id: "middle", label: "Storm in the middle", climaxPct: 42, contour: "reaching a boiling center before the last act settles" },
  { id: "rollercoaster", label: "Rollercoaster with wild swings", climaxPct: 55, contour: "sharp reversals of intensity balanced around a central peak" },
];

export const ENERGY_OPTIONS = [
  { id: "sparse", label: "Slow & spacious", words: ["slow", "spacious"] },
  { id: "steady", label: "Mid-tempo, rolling", words: ["midtempo", "rolling"] },
  { id: "club", label: "Club-tempo locked pocket", words: ["club", "unlocking"] },
  { id: "dense", label: "Fast & relentless", words: ["relentless", "breakbeat"] },
];

// ── Theme clarification (reusable, not Love-only) ───────────────────────
// Any broad central subject the wizard hears can be reinterpreted through
// these narrative stances. The mechanism is generic: the subject is a
// variable, the stance is an emotional reading that seeds the same blend +
// arc machinery everything else uses.
export const THEME_INTERPRETATION_OPTIONS = [
  {
    id: "newly-met",
    label: "Newly met",
    descriptor: "# has just arrived and still feels brand new",
    seed: [0.5, 0.1, 0.2, 0.1, 0.1],
    words: ["radiant", "glowing", "intimate"],
    contour: "a fresh discovery that slowly deepens",
    climaxPct: 60,
  },
  {
    id: "consuming",
    label: "All-consuming",
    descriptor: "# takes over the whole record",
    seed: [0.1, 0.35, 0.15, 0.1, 0.3],
    words: ["obsessive", "driven", "urgent"],
    contour: "unrelenting pressure building toward a single surrender",
    climaxPct: 74,
  },
  {
    id: "heartbreak",
    label: "Broken",
    descriptor: "# is lost, and the record grieves",
    seed: [0.15, 0.05, 0.6, 0.1, 0.1],
    words: ["sorrow", "emptiness", "fading"],
    contour: "a slow mourning that eventually steadies",
    climaxPct: 45,
  },
  {
    id: "reconciliation",
    label: "Reconciled",
    descriptor: "# was fought over, then made peace",
    seed: [0.55, 0.05, 0.2, 0.1, 0.1],
    words: ["resolved", "kind", "settled"],
    contour: "conflict that resolves into warmth",
    climaxPct: 55,
  },
  {
    id: "unreachable",
    label: "Unreachable",
    descriptor: "# never quite lands",
    seed: [0.1, 0.2, 0.3, 0.15, 0.25],
    words: ["cinematic", "volatile", "lonely"],
    contour: "a longing that circles without landing",
    climaxPct: 50,
  },
  {
    id: "aged",
    label: "Worn by time",
    descriptor: "the record watches # age",
    seed: [0.2, 0.15, 0.45, 0.1, 0.1],
    words: ["melancholic", "distant", "slow"],
    contour: "a long, patient perspective",
    climaxPct: 35,
  },
  {
    id: "first",
    label: "First and only",
    descriptor: "one # that changes everything once",
    seed: [0.1, 0.1, 0.15, 0.3, 0.35],
    words: ["volatile", "spectacle", "unpredictable"],
    contour: "a single irreversible turning point",
    climaxPct: 70,
  },
  {
    id: "open-door",
    label: "Still turning",
    descriptor: "# left a door open",
    seed: [0.3, 0.1, 0.25, 0.15, 0.2],
    words: ["cinematic", "unpredictable"],
    contour: "unresolved motion that keeps repeating",
    climaxPct: 48,
  },
];

// Capsules are broad central nouns worth one clarifying question. Asking about
// "love" is just the first case; any of these triggers the same mechanism.
export const AMBIGUOUS_CAPSULES = [
  "love", "home", "loss", "fear", "time", "family", "ambition", "god",
  "leaving", "longing", "the road", "heart", "hope", "memory", "distance",
];

export function capsuleOf(freeText) {
  if (!freeText || typeof freeText !== "string") return null;
  const text = ` ${freeText.toLowerCase()} `;
  return AMBIGUOUS_CAPSULES.find((c) => text.includes(` ${c} `)) || null;
}

/* When the narrative is a single broad subject, asks a reusable clarifying
 * question: which way does the album read # ? Returns the interpretation menu.
 */
export function requestThemeClarification(freeText) {
  const capsule = capsuleOf(freeText);
  if (!capsule) return null;
  return {
    capsule,
    ambiguous: true,
    options: THEME_INTERPRETATION_OPTIONS.map((o) => ({
      ...o,
      label: o.label,
      description: `${o.descriptor.replace("#", capsule)}. ${o.contour}.`,
    })),
  };
}

function tokensOf(text) {
  if (!text || typeof text !== "string") return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function wordVote(word, lexicon) {
  if (lexicon[word]) return lexicon[word];
  // fold compound spellings ("mid-heat" -> "midheat") onto the lexicon
  const compact = word.replace(/[^a-z]/g, "");
  return lexicon[compact] || null;
}

function accumulateWeight(words, lexicon) {
  const acc = ALBUM_ARCHETYPES.map(() => 0);
  const matched = [];
  let scored = 0;
  for (const word of words) {
    const vote = wordVote(word, lexicon);
    if (!vote) continue;
    scored += 1;
    acc.forEach((_, i) => { acc[i] += vote[i]; });
    matched.push(word);
  }
  return { acc, matched, scored };
}

function mergeSources(beginSeed, endSeed, energySeed, freeWeights, ownWeights) {
  // equal voice to every source so one answer never silently wins the album
  const sources = [beginSeed, endSeed, energySeed].filter(Boolean);
  const merged = ALBUM_ARCHETYPES.map((_, i) =>
    sources.reduce((sum, s) => sum + s[i], 0) + (freeWeights?.[i] || 0) + (ownWeights?.[i] || 0)
  );
  return normalizeWeights(merged.map((w, i) => w + 0.02));
}

function morphToward(from, to, t) {
  return from.map((w, i) => w * (1 - t) + to[i] * t);
}

export function intentToBlueprint({
  theme = "",
  albumName = "",
  genre = "bass-electronic",
  trackCount = 10,
  beginSeed = BEGINNING_OPTIONS[0].seed,
  beginWords = BEGINNING_OPTIONS[0].words,
  endSeed = ENDING_OPTIONS[0].seed,
  endWords = ENDING_OPTIONS[0].words,
  journey = JOURNEY_OPTIONS[0],
  energySeed = ENERGY_OPTIONS[1].words,
  freeText = "",
  tempoId = "locked",
  themeMeaning = null,
}) {
  const count = Math.max(4, Math.min(14, Number(trackCount) || 10));
  const meaning = themeMeaning && THEME_INTERPRETATION_OPTIONS.some((o) => o.id === themeMeaning.id)
    ? themeMeaning
    : null;
  const journeyResolved = meaning
    ? { ...journey, climaxPct: meaning.climaxPct ?? journey.climaxPct, contour: `${meaning.contour}. ${journey.contour}` }
    : journey;

  // Each soft source votes into the shared five-archetype blend space.
  const beginVote = accumulateWeight(beginWords, LEXICON);
  const endVote = accumulateWeight(endWords, LEXICON);
  const energyVote = accumulateWeight(energySeed, LEXICON);
  const freeVote = accumulateWeight(tokensOf(freeText), LEXICON);
  const meaningVote = meaning ? accumulateWeight(meaning.words, LEXICON) : { acc: ALBUM_ARCHETYPES.map(() => 0), matched: [] };
  const journeyMomentum = accumulateWeight(tokensOf(journeyResolved.contour), { rollercoaster: LEXICON.rollercoaster, driven: LEXICON.driven, explosive: LEXICON.explosive, quiet: LEXICON.quiet });

  const archetypeWeights = normalizeWeights(
    ALBUM_ARCHETYPES.map((_, i) =>
      (beginVote.acc[i] || 0) * 0.6
      + (endVote.acc[i] || 0) * 0.6
      + (energyVote.acc[i] || 0) * 0.8
      + (freeVote.acc[i] || 0) * 1
      + (meaningVote.acc[i] || 0) * 1.1
      + (journeyMomentum.acc[i] || 0) * 0.35
      + 0.5
    )
  );

  const matchedWords = [...beginVote.matched, ...endVote.matched, ...energyVote.matched, ...freeVote.matched, ...meaningVote.matched, ...journeyMomentum.matched];
  const meaningful = new Set([...beginWords, ...endWords, ...energySeed, ...(meaning ? meaning.words : []), ...tokensOf(journeyResolved.contour), ...tokensOf(freeText)]);
  const confidence = meaningful.size ? Math.min(1, matchedWords.length / meaningful.size) : 0.4;

  // Beginning/ending only seed blend coordinates for the outermost tracks; the
  // middle of the album stays on the conversational archetype blend, and the
  // engine's arc still decides roles and order.
  const slotWeights = Array.from({ length: count }, (_, i) => {
    const oneHot = archetypeWeights.slice();
    if (i === 0) return normalizeWeights(morphToward(oneHot, beginSeed, 0.85));
    if (i === count - 1) return normalizeWeights(morphToward(oneHot, endSeed, 0.85));
    if (i === count - 2) return normalizeWeights(morphToward(oneHot, endSeed, 0.55));
    const t = Math.max(0, 1 - i / 3);
    return normalizeWeights(morphToward(oneHot, beginSeed, t * 0.4));
  });

  const endingBiasIndex = endSeed.indexOf(Math.max(...endSeed));
  const seedBase = hashString(`${albumName}|${theme}|${genre}|${journey.id}|${meaning ? meaning.id : ""}`);
  const climaxPctOverride = journeyResolved.climaxPct;
  const tempoSeed = hashString(`${seedBase}|tempo|${tempoId}`);

  return {
    album: { name: albumName || "Untitled Album", genre, theme: theme.trim(), trackCount: count },
    archetypeWeights,
    beginBlend: beginSeed,
    endBlend: endSeed,
    slotWeights,
    endingBias: endingBiasIndex,
    climaxPctOverride,
    seedBase,
    journey: journeyResolved,
    meaning,
    tempo: { behavior: tempoId, seed: tempoSeed },
    matchedWords: [...new Set(matchedWords)],
    confidence,
    directionSummary: [
      `Starts ${BEGINNING_OPTIONS.find((o) => o.seed === beginSeed)?.label || "small"} / ${journeyResolved.contour} / ${ENDING_OPTIONS.find((o) => o.seed === endSeed)?.label || "resolved"}.`,
      `Energy ${ENERGY_OPTIONS.find((o) => o.words.join("|") === energySeed.join("|"))?.label || "mid-tempo"}.`,
      meaning ? `Reads "${theme}" as ${meaning.label.toLowerCase()}.` : "",
      `Tempo: ${TEMPO_OPTIONS.find((o) => o.id === tempoId)?.label || "Locked / hypnotic"}.`,
    ].filter(Boolean),
  };
}

export default intentToBlueprint;