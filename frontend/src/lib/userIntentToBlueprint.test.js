import {
  BEGINNING_OPTIONS,
  ENDING_OPTIONS,
  ENERGY_OPTIONS,
  JOURNEY_OPTIONS,
  THEME_INTERPRETATION_OPTIONS,
  capsuleOf,
  requestThemeClarification,
  intentToBlueprint,
} from "./userIntentToBlueprint";

const BASE = {
  theme: "city at night",
  albumName: "Neon Hours",
  genre: "bass-electronic",
  trackCount: 10,
};

describe("userIntentToBlueprint", () => {
  it("is deterministic for identical answers", () => {
    const a = intentToBlueprint(BASE);
    const b = intentToBlueprint(BASE);
    expect(a.slotWeights).toEqual(b.slotWeights);
    expect(a.archetypeWeights).toEqual(b.archetypeWeights);
    expect(a.seedBase).toBe(b.seedBase);
  });

  it("seeds the opening blend toward the beginning coordinate and the closer toward the ending coordinate", () => {
    const result = intentToBlueprint({
      ...BASE,
      beginSeed: BEGINNING_OPTIONS[1].seed, // "already in motion, mid-heat" -> hard/volatile heavy
      endSeed: ENDING_OPTIONS[3].seed, // "fade to nothing" -> melancholic heavy
    });
    const expectedBegin = BEGINNING_OPTIONS[1].seed;
    const expectedEnd = ENDING_OPTIONS[3].seed;
    const first = result.slotWeights[0];
    const last = result.slotWeights[result.slotWeights.length - 1];
    const firstMove = expectedBegin.indexOf(Math.max(...expectedBegin));
    const lastKeep = expectedEnd.indexOf(Math.max(...expectedEnd));
    expect(first[firstMove]).toBeGreaterThan(0.4);
    expect(last[lastKeep]).toBeCloseTo(0.5, 1);
    expect(first[0]).not.toBeGreaterThan(last[0]);
  });

  it("maps a slow-burn journey to a late peak override", () => {
    const result = intentToBlueprint({ ...BASE, journey: JOURNEY_OPTIONS[1] });
    expect(result.climaxPctOverride).toBe(72);
    const steady = intentToBlueprint({ ...BASE, journey: JOURNEY_OPTIONS[0] });
    expect(steady.climaxPctOverride).toBe(50);
  });

  it("sets endingBias from the ending coordinate's strongest archetype", () => {
    const result = intentToBlueprint({ ...BASE, endSeed: ENDING_OPTIONS[2].seed });
    expect(result.endingBias).toBe(ENDING_OPTIONS[2].seed.indexOf(Math.max(...ENDING_OPTIONS[2].seed)));
  });

  it("degrades gracefully on unknown words instead of crashing", () => {
    const clean = intentToBlueprint(BASE);
    const noisy = intentToBlueprint({ ...BASE, freeText: "xzqrm blorfung gleep" });
    expect(noisy.slotWeights.length).toBe(10);
    expect(noisy.archetypeWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(noisy.confidence).toBeLessThan(clean.confidence);
    expect(noisy.confidence).toBeGreaterThanOrEqual(0);
    expect(noisy.confidence).toBeLessThanOrEqual(1);
  });

  it("collects matched words for transparency", () => {
    const result = intentToBlueprint({
      ...BASE,
      beginWords: BEGINNING_OPTIONS[0].words,
      endWords: ENDING_OPTIONS[0].words,
      energySeed: ENERGY_OPTIONS[3].words,
    });
    expect(result.matchedWords.length).toBeGreaterThan(0);
    expect(result.directionSummary.length).toBeGreaterThanOrEqual(2);
  });

  it("detects broad narrative capsules for one clarifying question", () => {
    expect(capsuleOf("all about love")).toBe("love");
    expect(requestThemeClarification("an album about love")).toEqual(
      expect.objectContaining({ capsule: "love", ambiguous: true })
    );
    expect(requestThemeClarification("love")).toBeTruthy();
    expect(requestThemeClarification("neon rain over the freeway")).toBeNull();
    const menu = requestThemeClarification("love");
    expect(menu.options.length).toBe(THEME_INTERPRETATION_OPTIONS.length);
    // The mechanism is reusable: love options render with the subject swapped in.
    expect(menu.options[0].description).toContain("love");
  });

  it("applies a chosen interpretation as another soft voice, not a hardcode", () => {
    const sarcastic = THEME_INTERPRETATION_OPTIONS.find((o) => o.id === "heartbreak");
    const result = intentToBlueprint({ ...BASE, theme: "love", themeMeaning: sarcastic });
    expect(result.meaning).toBe(sarcastic);
    expect(result.climaxPctOverride).toBe(sarcastic.climaxPct);
    expect(result.directionSummary.some((l) => l.toLowerCase().includes("reads"))).toBe(true);
    // still deterministic and within the blend model
    expect(result.slotWeights.length).toBe(10);
    expect(result.archetypeWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("carries a tempo trajectory through to the blueprint args", () => {
    const result = intentToBlueprint({ ...BASE, tempoId: "peak-release" });
    expect(result.tempo).toEqual({ behavior: "peak-release", seed: expect.any(Number) });
    expect(result.directionSummary.some((l) => l.includes("Peak and release"))).toBe(true);
    const reroll = intentToBlueprint({ ...BASE, tempoId: "locked" });
    expect(reroll.tempo.behavior).toBe("locked");
    expect(reroll.tempo.seed).not.toBe(result.tempo.seed);
  });

  it("clamps track count to the engine's range", () => {
    const result = intentToBlueprint({ ...BASE, trackCount: 99 });
    expect(result.album.trackCount).toBe(14);
    expect(result.slotWeights.length).toBe(14);
  });
});