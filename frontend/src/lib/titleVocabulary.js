/* Project-wide, plot-first title world.
 *
 * A title is a scene, not a descriptor. Instead of assembling "Adjective + Noun"
 * templates with theme words jammed in, each album builds a small *world* from
 * its narrative, then names its tracks after objects, places, moments, phrases,
 * and metaphors in that world. Titles stay connected to the project without any
 * two tracks echoing the same root or suffix.
 *
 * Pure + deterministic: same inputs → same titles; a variant seed re-rolls the
 * set without collisions.
 */

const FAMILIES = {
  weather: {
    keywords: ["rain", "storm", "wind", "fog", "snow", "heat", "sky", "cloud", "sun", "thunder"],
    artifacts: [
      "Rain on the Tin Roof",
      "The Storm Cellar",
      "Slow Fog on the Causeway",
      "A Season of First Frost",
      "Static Between Storms",
      "The Thunder Without Rain",
      "Heat Line at Midnight",
    ],
  },
  water: {
    keywords: ["water", "ocean", "river", "lake", "sea", "tide", "flood", "boat", "harbor", "swim"],
    artifacts: [
      "Undertow",
      "The River's Long Answer",
      "Boat Lights Going Home",
      "Salt on the Harbor Wall",
      "Downstream of the House",
      "A Tide That Forgets",
      "The Pool Under the Boardwalk",
    ],
  },
  architecture: {
    keywords: ["city", "house", "room", "window", "roof", "basement", "corridor", "bridge", "tower", "station", "door"],
    artifacts: [
      "The Room Behind the Stairs",
      "Basement Echo",
      "Windows of the Empty Terminal",
      "The Bridge at Last Toll",
      "Stairwell Hum",
      "House Heard From Outside",
      "A Door Open to the Roof",
    ],
  },
  machine: {
    keywords: ["machine", "engine", "wire", "current", "signal", "static", "circuit", "motor", "tape", "radio", "gear"],
    artifacts: [
      "Motor Without a Vehicle",
      "Tape Hiss Between Songs",
      "The Relay at 4AM",
      "Signal Lost Near the Plant",
      "Wires Under the New Plaster",
      "A Machine That Remembers",
      "Dial Tone for Nobody",
    ],
  },
  flight: {
    keywords: ["fly", "wings", "bird", "air", "orbit", "gravity", "drift", "fall", "climb", "height"],
    artifacts: [
      "The Long Glide Down",
      "Altitude Without a Map",
      "Feathers on the Runway",
      "Second Orbit of the Moon",
      "Where the Lift Runs Out",
      "A Bird Over the Freeway",
      "Weightless in the Hangar",
    ],
  },
  flame: {
    keywords: ["fire", "flame", "burn", "ember", "ash", "smoke", "spark", "lantern"],
    artifacts: [
      "Embers in the Rain Barrel",
      "Smoke Reading at Dusk",
      "The Lantern Out of Oil",
      "Cinder Path Home",
      "A Slow Burn Without Glow",
      "Spark Between the Hands",
      "Ash Kept in a Tin",
    ],
  },
  time: {
    keywords: ["time", "clock", "hour", "dawn", "dusk", "midnight", "season", "year", "past", "future"],
    artifacts: [
      "The Hour That Doesn't Exist",
      "Clock Hands Caught Mid-Swing",
      "Dawn After the Argument",
      "A Season of Short Days",
      "Next Year's Same Street",
      "The Half-Hour Between",
      "Time Leaning on the Door",
    ],
  },
  growth: {
    keywords: ["grow", "seed", "root", "bloom", "garden", "field", "green", "harvest", "spring", "forest", "tree", "woods", "canopy"],
    artifacts: [
      "Roots in the Foundation",
      "The Garden Before Rain",
      "Bloom After the Last Kite",
      "Field Without a Fence",
      "A Seed in the Cold Ground",
      "Vine Over the Broken Window",
      "Harvest Moon in the Alley",
    ],
  },
  light: {
    keywords: ["light", "glow", "shadow", "dark", "gleam", "lamp", "bright", "dim"],
    artifacts: [
      "The Lamp on the Empty Bus",
      "Secondhand Light",
      "Shadows of a Passing Car",
      "The Dim Room Between Floors",
      "Gleam Collecting in the Corner",
      "Dark That Arrives Softly",
      "A Light Left On All Night",
    ],
  },
};

const LONE_ARTIFACTS = [
  "The Road That Forgets Its Name",
  "Static After the Last Song",
  "A Letter Left Ungiven",
  "The Key to a Shared Room",
  "Thread Across the Parking Lot",
  "The Old Scoreboard Dimming",
  "Shoes at the Back Door",
  "The Wrong Page Number",
  "Snow Inside a Glass Globe",
  "Whistle at Depot Closing",
  "The Map Folded Wrong",
  "Handprints on the Window",
  "The Ticket Kept in a Coat",
  "Silence in the Trailer Aisle",
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
    .slice(0, 5);
}

function familyScore(family, tokens) {
  return tokens.reduce((acc, token) => {
    const kw = family.keywords.some((k) => token.includes(k) || k.includes(token));
    return acc + (kw ? 1 : 0);
  }, 0);
}

function significantWords(artifact, seen) {
  return artifact
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length > 3 && !["the", "that"].includes(w));
}

function dedupeByRoot(candidates, count) {
  const seen = new Set();
  const picked = [];
  for (const artifact of candidates) {
    const words = significantWords(artifact, seen);
    const sharesRoot = words.some((w) => seen.has(w));
    if (sharesRoot) continue;
    words.forEach((w) => seen.add(w));
    picked.push(artifact);
    if (picked.length >= count) break;
  }
  return picked;
}

/* Builds the album's semantic world from the narrative:
 * gives back the world's dominant families and enough deduped artifacts to
 * name every track once without repeating a root.
 */
export function createProjectVocabulary({ theme = "", templateName = "", genreLabel = "", trackCount = 10, seedBase = 0 }) {
  const seed = hashString(`${theme}|${templateName}|${genreLabel}|${seedBase}`);
  const random = mulberry32(seed);
  const tokens = cleanTokens(theme);
  // Raw theme words (3+ chars) keep short narrative markers like "fog", "ebb"
  // alive for world-scoring; template terms do not.
  const rawTokens = (theme || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 3);
  const total = Math.max(1, Number(trackCount) || 10);

  const scored = Object.entries(FAMILIES)
    .map(([name, family]) => ({ name, family, score: familyScore(family, rawTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  let dominant = scored.slice(0, 3).map((s) => s.name);

  // No narrative hooks matched: fall back to a deterministic pick so the world
  // always has somewhere to stand.
  if (dominant.length === 0) {
    const pick = shuffle(Object.keys(FAMILIES), random).slice(0, 2);
    dominant = pick;
  }

  const familyBag = shuffle(
    dominant.flatMap((name) => FAMILIES[name].artifacts),
    random
  );
  const worldBag = dedupeByRoot(familyBag, total);

  const extendedFromOthers = worldBag.length < total
    ? dedupeByRoot(
        shuffle(
          Object.entries(FAMILIES)
            .filter(([name]) => !dominant.includes(name))
            .flatMap(([, f]) => f.artifacts)
            .concat(LONE_ARTIFACTS),
          random
        ),
        total - worldBag.length
      )
    : [];

  const all = [...worldBag, ...extendedFromOthers];

  // A variant seed re-shuffles the same world; the set is identical but the
  // order changes, so every slot gets a fresh, still-unique title.
  const title = (slotIndex, seed = 0) => {
    const ordered = shuffle(all, mulberry32(seed + 1));
    return ordered[slotIndex % ordered.length];
  };

  return {
    world: dominant.map((n) => ({
      name: n,
      artifactCount: FAMILIES[n].artifacts.length,
    })),
    artifacts: all,
    title,
  };
}

export { hashString };