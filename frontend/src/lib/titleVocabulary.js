/* Theme-conditioned, project-unique title vocabulary.
 *
 * Solves the "Analog Pulse / Night Drive / Velvet Signal / Afterglow" repetition:
 * titles are drawn from a per-project word pool seeded by the album theme, genre,
 * template, and a project base seed. No two slots in the same project repeat a
 * title, and a variant seed re-rolls the whole set without collisions.
 *
 * This is a pure, deterministic module — the same inputs always produce the same
 * titles — so it is test-safe and re-rollable.
 */

const OPENING_NOUNS = [
  "Arrival", "Threshold", "Ascent", "Drift", "Return", "Veil", "Gravity", "Flicker",
  "Current", "Horizon", "Signal", "Echo", "Vessel", "Mirror", "Clock", "Passage",
];

const CLOSING_NOUNS = [
  "Last Light", "Blue Hour", "Silver Line", "Night Bloom", "Low Orbit", "Cold Static",
  "Open Sky", "Inner Lane", "Second Dawn", "Still Water", "High Ground", "Red Shift",
  "Gold Room", "Quiet Hours", "Afterimage", "Slow Burn",
];

const THEME_ADJECTIVES = [
  "distant", "burning", "luminous", "hollow", "static", "velvet", "amber", "haloed",
  "broken", "rising", "buried", "fading", "electric", "hushed", "ancient", "modern",
];

const PLACE_WORDS = [
  "Detroit", "Midtown", "Freeway", "Station", "Corridor", "Basement", "Roof", "Arcade",
  "Quarter", "District", "Depot", "Voyage", "Nightswim", "Skyline", "Tunnel", "Overpass",
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(list, random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cleanTokens(theme) {
  if (!theme) return [];
  return theme
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 3)
    .slice(0, 4);
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function distinct(list) {
  return [...new Set(list.filter(Boolean))];
}

/* Builds the per-project pool of first words.
 * Theme keywords are always surfaced first so the narrative shapes the titles;
 * genre/template flavors fill the rest so the palette stays on-brand.
 */
function buildFirstPool({ theme, templateName, random }) {
  const tokens = cleanTokens(theme);
  const themed = tokens.map(capitalize);
  const flavored = shuffle([...THEME_ADJECTIVES].map(capitalize).slice(0, 6), random);
  const template = templateName ? [templateName.split(" ")[0]] : [];
  return distinct([...themed, ...template, ...flavored]);
}

/* Builds the per-project pool of second words. Always seeded by theme words too,
 * plus closing nouns and modifiers drawn from the genre voice.
 */
function buildSecondPool({ theme, random }) {
  const tokens = cleanTokens(theme);
  const themed = tokens.slice(1).map(capitalize);
  const closings = shuffle(CLOSING_NOUNS, random);
  const places = shuffle(PLACE_WORDS, random);
  return distinct([...themed, ...closings, ...places]);
}

/* Returns a deterministic per-project vocabulary object:
 *   .first, .second          — the seeded pools (exposed for the inspector)
 *   .title(slotIndex, seed)  — a title unique within the project for a seed
 */
export function createProjectVocabulary({ theme = "", templateName = "", genreLabel = "", trackCount = 10, seedBase = 0 }) {
  const seed = hashString(`${theme}|${templateName}|${genreLabel}|${seedBase}`);
  const random = mulberry32(seed);
  const first = buildFirstPool({ theme, templateName, random });
  const second = buildSecondPool({ theme, random });
  const total = Math.max(1, Number(trackCount) || 10);

  const pickers = first.length && second.length
    ? first
    : shuffle(OPENING_NOUNS, random);
  const suffixPick = second.length ? second : shuffle(CLOSING_NOUNS, random);
  const firstLen = Math.max(1, pickers.length);
  const secondLen = Math.max(1, suffixPick.length);
  const comboSpace = firstLen * secondLen;

  // Stride by firstLen so each slot advances through the *first* pool too;
  // a small first pool still yields unique (a, b) pairs for a full album.
  const title = (slotIndex, seed = 0) => {
    const k = (slotIndex * firstLen + seed * Math.max(total, firstLen)) % comboSpace;
    const a = pickers[Math.floor(k / secondLen) % firstLen];
    const b = suffixPick[k % secondLen];
    return `${a} ${b}`;
  };

  return { first, second, title };
}

export { hashString };