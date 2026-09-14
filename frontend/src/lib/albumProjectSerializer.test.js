import { buildAlbumBlueprint } from "./albumEngine";
import { BEGINNING_OPTIONS, ENDING_OPTIONS, JOURNEY_OPTIONS, intentToBlueprint } from "./userIntentToBlueprint";
import { serializeAlbum, deserializeAlbum, ALBUM_ENGINE_VERSION } from "./albumProjectSerializer";
import validateMatrix from "./matrixValidation";

function buildIntentAlbum({ genre = "techno", theme = "a city crossing the last block from dusk to dawn", count = 10, tempoId = "locked", meaningId = null } = {}) {
  const meaning = meaningId ? { id: meaningId } : null;
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
  return {
    intent,
    blueprint: buildAlbumBlueprint({
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
    }),
  };
}

describe("albumProjectSerializer", () => {
  it("round-trips a resolved blueprint byte-for-byte", () => {
    const { blueprint } = buildIntentAlbum();
    const serialized = serializeAlbum(blueprint, {
      name: "Night Signal",
      genre: "techno",
      theme: "a city crossing the last block from dusk to dawn",
      trackCount: 10,
      templateArchetype: 4,
      albumNonce: 0,
      wizardDna: { archetypeWeights: [0, 0, 0, 0, 1] },
      slotEdits: {},
      approval: { plan: true, slots: { 0: "approved" } },
    });
    const restored = deserializeAlbum(serialized);
    expect(restored.warnings).toEqual([]);
    expect(restored.engineMatches).toBe(true);
    expect(restored.name).toBe("Night Signal");
    expect(restored.blueprint).toEqual(blueprint);
    expect(restored.blueprint.slots).toHaveLength(10);
    expect(restored.approval).toEqual({ plan: true, slots: { 0: "approved" } });

    // A stored blueprint must reproduce the exact same matrix + journey so a
    // re-opened project validates identically to the one that was saved.
    expect(validateMatrix(restored.blueprint)).toEqual(validateMatrix(blueprint));
  });

  it("carries edits through the round-trip", () => {
    const { blueprint } = buildIntentAlbum();
    const slotEdits = { 3: { note: "lead with a detuned sub drop" }, 7: { variantSeed: 2 } };
    const serialized = serializeAlbum(blueprint, {
      name: "Night Signal",
      genre: "techno",
      theme: "t",
      trackCount: 10,
      templateArchetype: 4,
      albumNonce: 0,
      wizardDna: null,
      slotEdits,
      approval: {},
    });
    const restored = deserializeAlbum(serialized);
    expect(restored.inputs.slotEdits).toEqual(slotEdits);
    expect(restored.blueprint).toEqual(blueprint);
  });

  it("warns when inputs disagree with the stored snapshot", () => {
    const { blueprint } = buildIntentAlbum({ count: 8 });
    const serialized = serializeAlbum(blueprint, {
      name: "Night Signal",
      genre: "techno",
      theme: "t",
      trackCount: 8,
      templateArchetype: 4,
      albumNonce: 0,
      wizardDna: null,
      slotEdits: {},
      approval: {},
    });
    const mismatched = { ...serialized, inputs: { ...serialized.inputs, trackCount: 10 } };
    const restored = deserializeAlbum(mismatched);
    expect(restored.warnings.length).toBeGreaterThan(0);
    expect(restored.blueprint.slots).toHaveLength(8);
  });

  it("flags mismatched engine versions without rerolling prompts", () => {
    const { blueprint } = buildIntentAlbum();
    const serialized = serializeAlbum(blueprint, {
      name: "Night Signal",
      genre: "techno",
      theme: "t",
      trackCount: 10,
      templateArchetype: 4,
      albumNonce: 0,
      wizardDna: null,
      slotEdits: {},
      approval: {},
    });
    const older = { ...serialized, engine_version: "album-engine-v2.5" };
    const restored = deserializeAlbum(older);
    expect(restored.engineMatches).toBe(false);
    expect(restored.warnings.some((w) => w.includes("album-engine-v2.5"))).toBe(true);
    expect(restored.blueprint.slots[0].prompt).toBe(blueprint.slots[0].prompt);
  });

  it("rejects a payload with no blueprint", () => {
    const restored = deserializeAlbum({ name: "Broken", engine_version: ALBUM_ENGINE_VERSION, inputs: {}, blueprint: null, approval: {} });
    expect(restored.blueprint).toBeNull();
    expect(restored.warnings.length).toBeGreaterThan(0);
  });
});