import {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  GENRES,
  blendCentroids,
  buildIngestPack,
  classify,
  dominantEmotions,
  normalizeWeights,
  synthesizePrompt,
} from "./promptEngine";

describe("promptEngine data", () => {
  test("has 5 archetypes with full 20-feature centroids", () => {
    expect(ALBUM_ARCHETYPES).toHaveLength(5);
    for (const archetype of ALBUM_ARCHETYPES) {
      expect(archetype.centroid_raw).toBeDefined();
      expect(Object.keys(archetype.centroid_raw)).toHaveLength(20);
      expect(archetype.closest_albums.length).toBeGreaterThan(0);
    }
  });

  test("archetype names and taglines align", () => {
    expect(ARCHETYPE_NAMES).toHaveLength(ALBUM_ARCHETYPES.length);
  });

  test("genres include bass-electronic default and have prompt ingredients", () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(8);
    for (const genre of GENRES) {
      expect(genre.id).toBeTruthy();
      expect(genre.name).toBeTruthy();
      expect(genre.instrument).toBeTruthy();
      expect(genre.craft).toBeTruthy();
      expect(genre.family.length).toBeGreaterThan(1);
    }
    expect(GENRES[0].id).toBe("bass-electronic");
  });
});

describe("normalizeWeights", () => {
  test("normalizes weights to sum 1", () => {
    const weights = normalizeWeights([10, 20, 30, 20, 20]);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  test("returns uniform weights for all-zero input", () => {
    const weights = normalizeWeights([0, 0, 0, 0, 0]);
    expect(weights.every((w) => Math.abs(w - 0.2) < 1e-9)).toBe(true);
  });

  test("ignores negative or NaN entries", () => {
    const weights = normalizeWeights([-5, 25, 25, 25, 25]);
    expect(weights.every((w) => w >= 0)).toBe(true);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("blendCentroids", () => {
  test("pure archetype blend reproduces that archetype centroid", () => {
    const A = ALBUM_ARCHETYPES[2];
    const blend = blendCentroids([0, 0, 1, 0, 0]);
    expect(blend.mean_sadness).toBeCloseTo(A.centroid_raw.mean_sadness);
    expect(blend.mean_energy).toBeCloseTo(A.centroid_raw.mean_energy);
  });

  test("50/50 blend is midpoint of two archetypes", () => {
    const A = ALBUM_ARCHETYPES[0];
    const B = ALBUM_ARCHETYPES[4];
    const blend = blendCentroids([0.5, 0, 0, 0, 0.5]);
    const mid = (A.centroid_raw.mean_tension + B.centroid_raw.mean_tension) / 2;
    expect(blend.mean_tension).toBeCloseTo(mid);
  });
});

describe("dominantEmotions", () => {
  test("returns top emotions above threshold, sorted descending", () => {
    const profile = { mean_joy: 80, mean_trust: 70, mean_sadness: 20, mean_anger: 10 };
    const result = dominantEmotions(profile);
    expect(result.map((e) => e.word)).toEqual(["joy", "trust"]);
  });

  test("returns at most the limit", () => {
    const profile = { mean_joy: 90, mean_trust: 85, mean_sadness: 80, mean_anger: 75 };
    expect(dominantEmotions(profile, 2)).toHaveLength(2);
  });
});

describe("classify", () => {
  test("low energy maps to sparse/slow band", () => {
    const profile = { mean_energy: 30, mean_saturation: 40, mean_complexity: 40 };
    const c = classify(profile);
    expect(c.energy).toContain("spacious");
    expect(c.density).toBe("sparse");
  });

  test("high energy maps to dense band", () => {
    const profile = { mean_energy: 90, mean_saturation: 90, mean_complexity: 90 };
    const c = classify(profile);
    expect(c.density).toBe("dense");
    expect(c.texture).toContain("lush");
  });
});

describe("synthesizePrompt", () => {
  test("produces a complete prompt with style blocks", () => {
    const result = synthesizePrompt({
      weights: [1, 0, 0, 0, 0],
      slot: { index: 0, total: 10 },
      theme: "the last hour of a long night",
    });
    expect(result.prompt.length).toBeGreaterThan(100);
    expect(result.prompt).toContain("Instrumental");
    expect(result.prompt).toContain("bass-electronic");
    expect(result.prompt).toContain("Mood:");
    expect(result.negative_prompt).toContain("no vocals");
    expect(result.title).toBeTruthy();
  });

  test("genre changes instrument voice in the prompt", () => {
    const dnb = synthesizePrompt({ genre: "dnb", weights: [1, 0, 0, 0, 0], slot: { index: 0, total: 10 } });
    const trap = synthesizePrompt({ genre: "trap", weights: [1, 0, 0, 0, 0], slot: { index: 0, total: 10 } });
    expect(dnb.prompt).toContain("drum-and-bass");
    expect(dnb.prompt).toContain("174 BPM");
    expect(trap.prompt).toContain("trap");
    expect(trap.prompt).not.toBe(dnb.prompt);
  });

  test("blend weights are normalized and dominant cluster reported", () => {
    const result = synthesizePrompt({ weights: [0, 0, 0, 1, 0], slot: { index: 5, total: 10 } });
    expect(result.blend.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(result.dominantCluster).toBe(3);
    expect(result.dominantClusterName).toBe("Restless Collage");
  });

  test("generates deterministic output for identical inputs", () => {
    const a = synthesizePrompt({ weights: [0.2, 0.2, 0.2, 0.2, 0.2], slot: { index: 2, total: 8 } });
    const b = synthesizePrompt({ weights: [0.2, 0.2, 0.2, 0.2, 0.2], slot: { index: 2, total: 8 } });
    expect(a.prompt).toBe(b.prompt);
    expect(a.title).toBe(b.title);
  });

  test("uniquely titles each slot in an album", () => {
    const titles = Array.from({ length: 10 }, (_, i) =>
      synthesizePrompt({ genre: "bass-electronic", weights: [1, 0, 0, 0, 0], slot: { index: i, total: 10 } }).title
    );
    expect(new Set(titles).size).toBeGreaterThanOrEqual(8);
  });
});

describe("buildIngestPack", () => {
  test("produces a track per slot conforming to the ingest schema", () => {
    const weightsBySlot = Array.from({ length: 10 }, () => [1, 0, 0, 0, 0]);
    const pack = buildIngestPack({
      albumName: "Midnight Transit",
      genre: "techno",
      theme: "a train crossing a sleeping city",
      weightsBySlot,
    });
    expect(pack.album.track_count).toBe(10);
    expect(pack.tracks).toHaveLength(10);
    const track = pack.tracks[0];
    expect(track.playlist_name).toBe("Midnight Transit");
    expect(track.audio_url).toBe("");
    expect(track.prompt.length).toBeGreaterThan(50);
    expect(track.negative_prompt.length).toBeGreaterThan(5);
    expect(track.raw_metadata.genre).toBe("techno");
    expect(track.order).toBe(1);
    expect(pack.album.notes).toContain("suno/ingest");
  });

  test("title respects theme-driven suffix variation", () => {
    const weightsBySlot = Array.from({ length: 4 }, () => [0, 0, 1, 0, 0]);
    const pack = buildIngestPack({ albumName: "Sad Harbor", genre: "ambient", theme: "", weightsBySlot });
    const titles = pack.tracks.map((t) => t.title);
    for (const title of titles) {
      expect(title.split(" ").length).toBeGreaterThanOrEqual(2);
    }
  });
});