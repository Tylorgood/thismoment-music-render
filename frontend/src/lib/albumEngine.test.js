import {
  TRACK_ROLES,
  buildAlbumBible,
  buildAlbumArc,
  buildAlbumBlueprint,
  buildAlbumIngestPack,
  buildPasteSheet,
  buildAlbumExport,
  explainSlot,
  regenerateSlot,
} from "./albumEngine";
import { ALBUM_ARCHETYPES, GENRES } from "./promptEngine";

const CONFIG = {
  albumName: "Night Signal",
  genre: "techno",
  archetypeIndex: 4,
  theme: "a city crossing the last block from dusk to dawn",
  trackCount: 10,
};

describe("albumEngine: album bible", () => {
  it("builds an album bible with shared anchor lines and arc info", () => {
    const bible = buildAlbumBible(CONFIG);
    expect(bible.album.name).toBe("Night Signal");
    expect(bible.album.genre).toBe("techno");
    expect(bible.album.archetypeName).toBe(ALBUM_ARCHETYPES[4] && "Volatile Cinema");
    expect(bible.album.trackCount).toBe(10);
    expect(bible.anchor.instrument.length).toBeGreaterThan(20);
    expect(bible.anchor.motif).toContain("album");
    expect(bible.anchor.tagline.length).toBeGreaterThan(0);
    expect(bible.anchor.moodRange.length).toBeGreaterThan(0);
    expect(bible.bpmCenter).toBeGreaterThan(0);
    expect(bible.arc.slots).toHaveLength(10);
  });

  it("places the climax roughly at the archetype climax_track_index_pct", () => {
    for (let i = 0; i < ALBUM_ARCHETYPES.length; i += 1) {
      const bible = buildAlbumBible({ ...CONFIG, archetypeIndex: i });
      const pct = ALBUM_ARCHETYPES[i].centroid_raw.climax_track_index_pct;
      const expected = Math.round((pct / 100) * 9);
      expect(bible.climaxPosition.slotIndex).toBe(expected);
      expect(bible.arc.climaxIndex).toBe(expected);
    }
  });

  it("keeps the emotional DNA identical to the template archetype", () => {
    const bible = buildAlbumBible(CONFIG);
    const profile = bible.profile;
    expect(profile.mean_joy).toBeCloseTo(ALBUM_ARCHETYPES[4].centroid_raw.mean_joy, 6);
  });
});

describe("albumEngine: track roles + arc", () => {
  it("always starts with an opener and finishes with a closer", () => {
    for (const n of [4, 6, 8, 10, 14]) {
      const { slots } = buildAlbumArc({ trackCount: n, archetypeIndex: 0 });
      expect(slots[0].roleId).toBe("opener");
      expect(slots[n - 1].roleId).toBe("closer");
      expect(slots).toHaveLength(n);
    }
  });

  it("assigns exactly one climax at the archetype-driven slot", () => {
    const { slots, climaxIndex } = buildAlbumArc({ trackCount: 10, archetypeIndex: 4 });
    const climaxes = slots.filter((s) => s.roleId === "climax");
    expect(climaxes).toHaveLength(1);
    expect(climaxes[0].index).toBe(climaxIndex);
  });

  it("includes an interlude for longer albums", () => {
    const { slots } = buildAlbumArc({ trackCount: 10, archetypeIndex: 0 });
    expect(slots.some((s) => s.roleId === "interlude")).toBe(true);
  });

  it("every role in the catalogue is usable by the arc", () => {
    const ids = new Set(TRACK_ROLES.map((r) => r.id));
    const used = new Set(
      buildAlbumArc({ trackCount: 14, archetypeIndex: 3 }).slots.map((s) => s.roleId)
    );
    for (const id of ids) expect(used.has(id)).toBe(true);
  });

  it("respects role energy offsets when shifting the energy band", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const peaks = blueprint.slots
      .filter((s) => s.role === "climax")
      .map((s) => s.analysis.energy);
    const interludes = blueprint.slots
      .filter((s) => s.role === "interlude")
      .map((s) => s.analysis.energy);
    expect(peaks.length).toBe(1);
    expect(interludes.length).toBeGreaterThan(0);
  });
});

describe("albumEngine: blueprint + per-slot prompt assembly", () => {
  it("builds one slot brief per track with all required surfaces", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    expect(blueprint.slots).toHaveLength(10);
    for (const s of blueprint.slots) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.prompt.length).toBeGreaterThan(80);
      expect(s.negative_prompt.length).toBeGreaterThan(0);
      expect(s.bpm).toBeGreaterThan(70);
      expect(s.bpm).toBeLessThan(200);
      expect(s.analysis).toBeDefined();
      expect(s.blend).toHaveLength(ALBUM_ARCHETYPES.length);
    }
  });

  it("rolls an intensity/role arc without drifting the emotional DNA", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const opener = blueprint.slots[0];
    const closer = blueprint.slots[blueprint.slots.length - 1];
    const climax = blueprint.slots.find((s) => s.role === "climax");
    expect(climax.intensity).toBe(1);
    expect(closer.intensity).toBeLessThan(opener.intensity);
    expect(opener.profile.mean_joy).toBeCloseTo(closer.profile.mean_joy, 8);
    expect(opener.role).toBe("opener");
    expect(closer.role).toBe("closer");
  });

  it("shares the album anchor (motif + instrument) across all tracks", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const anchor = blueprint.slots[0].prompt;
    for (const s of blueprint.slots) {
      expect(s.prompt).toContain(blueprint.bible.anchor.instrument);
      expect(s.prompt).toContain("Track " + (s.index + 1) + " of 10");
    }
    expect(anchor).toContain("album");
  });

  it("expands the weight blend to cover other clusters when blended looks are needed", () => {
    const weights = [0, 0, 0, 1, 0];
    const blueprint = buildAlbumBlueprint({ ...CONFIG, slotWeights: { 4: weights } });
    const s = blueprint.slots[4];
    expect(blueprint.bible.album.archetypeIndex).toBe(4);
    expect(s.blend[3]).toBe(1);
  });
});

describe("albumEngine: regenerate slots without breaking continuity", () => {
  it("regenerates one slot and leaves bible + siblings untouched", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const before = blueprint.slots.map((s) => s.prompt);
    const priorRole = blueprint.slots[3].role;
    const next = regenerateSlot(blueprint, 3, { role: "lift" });
    expect(next.role).toBe("lift");
    expect(next.index).toBe(3);
    expect(next.prompt).not.toBe(before[3]);
    expect(next.blend).toEqual(blueprint.slots[3].blend);
    expect(blueprint.slots[0].prompt).toBe(before[0]);
    expect(blueprint.slots[3].role).toBe(priorRole);
  });

  it("throw a clear error for an out-of-range slot", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    expect(() => regenerateSlot(blueprint, 99)).toThrow(/no slot/);
  });

  it("preserves the album-wide continuity while swapping a role", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const next = regenerateSlot(blueprint, 2, { role: "interlude" });
    expect(next.role).toBe("interlude");
    expect(next.prompt).toContain(blueprint.bible.anchor.motif);
    expect(next.prompt).toContain("Track 3 of 10");
  });

  it("throw a clear error for an out-of-range slot", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    expect(() => regenerateSlot(blueprint, 99)).toThrow(/no slot/);
  });
});

describe("albumEngine: role overrides + per-slot variants", () => {
  it("applies role overrides to the arc without disturbing the bible", () => {
    const blueprint = buildAlbumBlueprint({ ...CONFIG, roleOverrides: { 5: "interlude", 4: "lift" } });
    expect(blueprint.slots[5].role).toBe("interlude");
    expect(blueprint.slots[4].role).toBe("lift");
    expect(blueprint.bible.roleOverrides).toEqual({ 5: "interlude", 4: "lift" });
    expect(blueprint.slots[0].prompt).toContain(blueprint.bible.anchor.motif);
    // The override space used to hold the default body slot is now occupied elsewhere
    const roles = blueprint.slots.map((s) => s.role);
    expect(roles.filter((r) => r === "interlude")).toHaveLength(2);
  });

  it("variant seeds change the title deterministically and keep the anchor", () => {
    const a = buildAlbumBlueprint({ ...CONFIG, variantSeeds: { 3: 0 } });
    const b = buildAlbumBlueprint({ ...CONFIG, variantSeeds: { 3: 0 } });
    const c = buildAlbumBlueprint({ ...CONFIG, variantSeeds: { 3: 2 } });
    expect(a.slots[3].title).toBe(b.slots[3].title);
    expect(a.slots[3].title).not.toBe(c.slots[3].title);
    expect(a.slots[3].prompt).toBe(b.slots[3].prompt);
    expect(a.slots[3].prompt).toContain(a.bible.anchor.motif);
  });

  it("appends a per-slot note to the prompt and carries it into the ingest pack", () => {
    const blueprint = buildAlbumBlueprint({ ...CONFIG, slotNotes: { 2: "lead with a detuned sub drop" } });
    expect(blueprint.slots[2].note).toBe("lead with a detuned sub drop");
    expect(blueprint.slots[2].prompt).toContain("lead with a detuned sub drop");
    const pack = buildAlbumIngestPack(blueprint);
    expect(pack.tracks[2].raw_metadata.note).toBe("lead with a detuned sub drop");
    expect(pack.tracks[2].raw_metadata.arc_climax_track).toBe(blueprint.bible.climaxPosition.slotIndex + 1);
  });

  it("regenerateSlot can move a slot to a new role with a variant + note in one call", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const next = regenerateSlot(blueprint, 6, { role: "climax", variantSeed: 3, note: "double the snare roll" });
    expect(next.role).toBe("climax");
    expect(next.variantSeed).toBe(3);
    expect(next.note).toBe("double the snare roll");
    expect(next.prompt).toContain("double the snare roll");
    expect(next.prompt).toContain(blueprint.bible.anchor.motif);
    expect(blueprint.slots[6].prompt).not.toBe(next.prompt);
  });

  it("buildAlbumExport embeds the arc and per-track role metadata", () => {
    const blueprint = buildAlbumBlueprint({ ...CONFIG, roleOverrides: { 1: "lift" } });
    const ex = buildAlbumExport(blueprint, {});
    const track = ex.ingest.tracks[1];
    expect(track.raw_metadata.role).toBe("lift");
    expect(ex.pasteSheet).toContain("Arc: opener");
    expect(ex.pasteSheet).toContain("→");
  });
});

describe("albumEngine: theme-conditioned titles + prompt diversity", () => {
  const THEMED = { ...CONFIG, theme: "driving through detroit at two in the morning" };

  it("produces unique titles within one project", () => {
    const blueprint = buildAlbumBlueprint(THEMED);
    const titles = blueprint.slots.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("conditioned on the narrative: different themes give different title sets", () => {
    const a = buildAlbumBlueprint(THEMED).slots.map((s) => s.title).join("|");
    const b = buildAlbumBlueprint({ ...CONFIG, theme: "a clearing of ancient fog forest" }).slots.map((s) => s.title).join("|");
    expect(a).not.toBe(b);
    const themedWord = ["Clearing", "Ancient", "Forest"].some((w) => b.includes(w));
    expect(themedWord).toBe(true);
  });

  it("variant seeds re-roll titles without duplicates", () => {
    const one = buildAlbumBlueprint(THEMED);
    const two = buildAlbumBlueprint({ ...THEMED, seedBase: 1 });
    const a = one.slots.map((s) => s.title);
    const b = two.slots.map((s) => s.title);
    expect(new Set(a).size).toBe(a.length);
    expect(new Set(b).size).toBe(b.length);
    expect(a).not.toEqual(b);
    expect(new Set(a).size + new Set(b).size).toBeGreaterThan(a.length);
  });

  it("keeps the recursive anchor lines byte-identical while varying scene openings", () => {
    const blueprint = buildAlbumBlueprint(THEMED);
    const anchorInstrument = blueprint.bible.anchor.instrument;
    const anchorMotif = blueprint.bible.anchor.motif;
    const openings = new Set();
    for (const s of blueprint.slots) {
      expect(s.prompt).toContain(anchorInstrument);
      expect(s.prompt).toContain(anchorMotif);
      const open = (s.prompt.match(/^Track \d+ of \d+ — [a-z]+\. [A-Z][^.]*\./)?.[0] || "").slice(0, 40);
      openings.add(s.prompt.split(". ")[1]);
    }
    expect(openings.size).toBeGreaterThan(1);
  });

  it("ends the album toward the endingBias coordinate without duplicating the bible", () => {
    const plain = buildAlbumBlueprint(CONFIG);
    const biased = buildAlbumBlueprint({ ...CONFIG, endingBias: 2 });
    const plainLast = plain.slots[plain.slots.length - 1].blend;
    const biasedLast = biased.slots[biased.slots.length - 1].blend;
    expect(biasedLast[2]).toBeGreaterThan(plainLast[2]);
    expect(biased.bible.album.archetypeIndex).toBe(CONFIG.archetypeIndex);
  });
});

describe("albumEngine: arc knobs + plain-language explainer", () => {
  it("honors climaxPctOverride for early and late peaks", () => {
    const early = buildAlbumArc({ trackCount: 10, archetypeIndex: 2, climaxPctOverride: 25 });
    const mid = buildAlbumArc({ trackCount: 10, archetypeIndex: 2, climaxPctOverride: 50 });
    const late = buildAlbumArc({ trackCount: 10, archetypeIndex: 2, climaxPctOverride: 78 });
    expect(early.climaxIndex).toBe(2);
    expect(mid.climaxIndex).toBe(5);
    expect(late.climaxIndex).toBe(7);
    expect(early.climaxPct).toBe(25);
  });

  it("explainSlot describes an opener, a middle track, and the closer", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const slots = blueprint.slots;
    const opener = explainSlot(slots[0], null, slots[1]);
    expect(opener.job).toContain("Opener");
    expect(opener.inherits).toContain("Opens the album");
    expect(opener.movesNext).toContain("Track 2");

    const mid = explainSlot(slots[4], slots[3], slots[5]);
    expect(mid.inherits).toContain("Picks up");
    expect(mid.changes).toContain("BPM");
    expect(mid.changes).toContain("intensity");
    expect(mid.emotionalDirection.length).toBeGreaterThan(0);

    const closer = explainSlot(slots[slots.length - 1], slots[slots.length - 2], null);
    expect(closer.job).toContain("Closer");
    expect(closer.movesNext).toContain("Closes the album");
  });

  it("survives absent neighbors (first and last) without crashing", () => {
    const slots = buildAlbumBlueprint(CONFIG).slots;
    const first = explainSlot(slots[0]);
    const last = explainSlot(slots[slots.length - 1]);
    expect(first.job.length).toBeGreaterThan(0);
    expect(last.job.length).toBeGreaterThan(0);
  });
});

describe("albumEngine: exports for the Suno workflow", () => {
  it("tracks match album size, are ordered, and share the playlist name", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const pack = buildAlbumIngestPack(blueprint, { token: "t-abc" });
    expect(pack.tracks).toHaveLength(10);
    pack.tracks.forEach((t, i) => {
      expect(t.token).toBe("t-abc");
      expect(t.playlist_name).toBe("Night Signal");
      expect(t.order).toBe(i + 1);
      expect(t.raw_metadata.role).toBe(blueprint.slots[i].role);
    });
    expect(pack.album.notes).toContain("POST each object to /music/suno/ingest");
  });

  it("generates a paste sheet that embeds every prompt and negative", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const sheet = buildPasteSheet(blueprint);
    expect(sheet).toContain("ALBUM: Night Signal");
    expect(sheet).toContain("SPREADSHEET PASTE BLOCK");
    for (const s of blueprint.slots) {
      expect(sheet).toContain(s.prompt);
      expect(sheet).toContain(s.negative_prompt);
    }
  });

  it("buildAlbumExport returns both ingest and paste sheet", () => {
    const blueprint = buildAlbumBlueprint(CONFIG);
    const ex = buildAlbumExport(blueprint, { token: "t-x" });
    expect(ex.ingest.tracks).toHaveLength(10);
    expect(ex.pasteSheet).toContain("ALBUM:");
  });
});