import { buildAlbumBlueprint } from "./albumEngine";
import { BEGINNING_OPTIONS, ENDING_OPTIONS, JOURNEY_OPTIONS, THEME_INTERPRETATION_OPTIONS, intentToBlueprint } from "./userIntentToBlueprint";
import {
  validateMatrix,
  validateSharedDNA,
  validatePromptSimilarity,
  validateChemistryOnTarget,
  validateArcFidelity,
  validateIdentityFields,
} from "./matrixValidation";
import { profileToGenome } from "./albumChemistry";

function buildIntentAlbum({ genre = "techno", theme = "a city crossing the last block from dusk to dawn", count = 10, tempoId = "locked", meaningId = null } = {}) {
  const meaning = meaningId ? THEME_INTERPRETATION_OPTIONS.find((o) => o.id === meaningId) : null;
  const intent = intentToBlueprint({
    albumName: "Night Signal",
    theme,
    genre,
    trackCount: count,
    beginSeed: BEGINNING_OPTIONS[1].seed,
    beginWords: BEGINNING_OPTIONS[1].words,
    endSeed: ENDING_OPTIONS[0].seed,
    endWords: ENDING_OPTIONS[0].words,
    journey: JOURNEY_OPTIONS[1],
    energySeed: ["slow", "spacious"],
    tempoId,
    themeMeaning: meaning,
  });
  return buildAlbumBlueprint({
    albumName: intent.album.name,
    genre: intent.album.genre,
    theme: intent.album.theme,
    trackCount: intent.album.trackCount,
    archetypeIndex: intent.archetypeWeights.indexOf(Math.max(...intent.archetypeWeights)),
    slotWeights: intent.slotWeights,
    climaxPctOverride: intent.climaxPctOverride,
    endingBias: intent.endingBias,
    seedBase: intent.seedBase,
    tempoBehavior: intent.tempo.behavior,
    tempoSeed: intent.tempo.seed,
  });
}

describe("matrixValidation", () => {
  it("passes a healthy wizard-driven album", () => {
    const blueprint = buildIntentAlbum();
    const matrix = validateMatrix(blueprint);
    expect(matrix.rules.sharedDNA.albumMean).toBeGreaterThanOrEqual(20);
    expect(matrix.rules.sharedDNA.albumMean).toBeLessThanOrEqual(40);
    expect(matrix.rules.promptSimilarity.maxJaccard).toBeLessThan(0.72);
    expect(matrix.rules.chemistryOnTarget.mad).toBeDefined();
    expect(matrix.rules.arcFidelity.level).not.toBe("fail");
    expect(matrix.level).not.toBe("fail");
  });

  it("flags near-identical prompts", () => {
    const slots = [
      { index: 0, prompt: "Slow warm blueprint track. Keep the motif. Sound original and cinematic." },
      { index: 1, prompt: "Slow warm blueprint track. Keep the motif. Sound original and cinematic." },
    ];
    const result = validatePromptSimilarity(slots);
    expect(result.level).toBe("fail");
    expect(result.worstPair).toEqual([0, 1]);
  });

  it("distinct prompts pass similarity", () => {
    const slots = [
      { index: 0, prompt: "A bright opener with brass stabs and a walking bassline." },
      { index: 1, prompt: "A mournful closer built from tape hiss and a lone keyboard." },
    ];
    expect(validatePromptSimilarity(slots).level).toBe("pass");
  });

  it("flags chemistry that drifts far from the album genome", () => {
    const genome = profileToGenome({ mean_joy: 50, mean_trust: 50, mean_fear: 50, mean_surprise: 50, mean_sadness: 50, mean_disgust: 50, mean_anger: 50, mean_anticipation: 50 });
    const far = { values: [90, 5, 90, 5, 90, 5, 90, 5], zeroDistance: 90 };
    const result = validateChemistryOnTarget({ slots: [{ chemistry: far }], genome });
    expect(result.level).toBe("fail");
  });

  it("validates arc fidelity: peak lands on the climax", () => {
    const slots = [
      { index: 0, role: "opener", intensity: 0.55, bpm: 100 },
      { index: 1, role: "body", intensity: 0.62, bpm: 100 },
      { index: 2, role: "climax", intensity: 1, bpm: 100 },
      { index: 3, role: "closer", intensity: 0.45, bpm: 100 },
    ];
    const result = validateArcFidelity({ slots, climaxIndex: 2, tempo: [100, 100, 100, 100], tempoBehavior: "locked" });
    expect(result.checks.every((c) => c.ok)).toBe(true);
    expect(result.level).toBe("pass");
  });

  it("warns when ending fails to resolve below the peak", () => {
    const slots = [
      { index: 0, role: "opener", intensity: 0.55, bpm: 100 },
      { index: 1, role: "climax", intensity: 1, bpm: 100 },
      { index: 2, role: "body", intensity: 1, bpm: 100 },
    ];
    const result = validateArcFidelity({ slots, climaxIndex: 1, tempo: [100, 100, 100], tempoBehavior: "locked" });
    expect(result.level).toBe("warn");
  });

  it("validates identity fields from the bible", () => {
    const bible = {
      anchor: {
        tagline: "resolved and warm",
        moodRange: ["joy", "trust"],
        colors: ["radiant"],
      },
    };
    expect(validateIdentityFields(bible).level).toBe("pass");
    expect(validateIdentityFields({ anchor: { moodRange: [] } }).level).toBe("warn");
  });

  it("reports aggregated matrix score and metrics", () => {
    const blueprint = buildIntentAlbum();
    const matrix = validateMatrix(blueprint);
    expect(matrix.score).toBeGreaterThanOrEqual(0);
    expect(matrix.rules.sharedDNA).toBeDefined();
    expect(matrix.rules.promptSimilarity).toBeDefined();
    expect(matrix.rules.chemistryOnTarget).toBeDefined();
    expect(matrix.rules.arcFidelity).toBeDefined();
    expect(matrix.rules.identityFields).toBeDefined();
    expect(matrix.metrics.maxIdentityOverlap).toBeLessThan(0.7);
  });
});