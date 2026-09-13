import {
  CHEMISTRY_KEYS,
  profileToGenome,
  composeChemistry,
  residualChemistry,
  buildFullChemistryArc,
} from "./albumChemistry";
import { blendCentroids, ALBUM_ARCHETYPES } from "./promptEngine";

function genomeOf(idx) {
  return profileToGenome(blendCentroids(ALBUM_ARCHETYPES.map((_, i) => (i === idx ? 1 : 0))));
}

describe("albumChemistry", () => {
  it("produces 8-dimensional chemistry with values in 0..100", () => {
    const chemistry = composeChemistry({
      genome: genomeOf(2),
      role: { id: "body", intensity: 0.62 },
      slotIndex: 4,
      climaxIndex: 6,
      trackCount: 10,
      prev: null,
      next: null,
      endTarget: genomeOf(0),
    });
    expect(chemistry.values).toHaveLength(8);
    chemistry.values.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
    expect(chemistry.activation).toBeGreaterThan(0);
    expect(chemistry.intensity).toBe(62);
    expect(chemistry.zeroDistance).toBeGreaterThan(0);
    expect(chemistry.dominant.length).toBeGreaterThan(0);
    expect(chemistry.purpose.length).toBeGreaterThan(0);
  });

  it("climax tracks surge on fear/anger/anticipation/surprise", () => {
    const genome = genomeOf(4);
    const climax = composeChemistry({
      genome,
      role: { id: "climax", intensity: 1 },
      slotIndex: 7,
      climaxIndex: 7,
      trackCount: 10,
      prev: null,
      next: null,
      endTarget: genomeOf(0),
    });
    const hot = ["fear", "anger", "anticipation", "surprise"].map((k) => climax.values[CHEMISTRY_KEYS.indexOf(k)]);
    const warm = ["trust", "joy"].map((k) => climax.values[CHEMISTRY_KEYS.indexOf(k)]);
    expect(Math.min(...hot)).toBeGreaterThan(Math.max(...warm));
  });

  it("inherits and transforms between adjacent tracks", () => {
    const genome = genomeOf(2);
    const t1 = composeChemistry({
      genome,
      role: { id: "opener", intensity: 0.55 },
      slotIndex: 0,
      climaxIndex: 6,
      trackCount: 10,
      prev: null,
      next: null,
      endTarget: genomeOf(0),
    });
    const prevVals = t1.values;
    const t2 = composeChemistry({
      genome,
      role: { id: "body", intensity: 0.62 },
      slotIndex: 1,
      climaxIndex: 6,
      trackCount: 10,
      prev: prevVals,
      next: null,
      endTarget: genomeOf(0),
    });
    expect(t2.inherited).toEqual(expect.any(Array));
    expect(t2.strengthened).toEqual(expect.any(Array));
    expect(t2.reduced).toEqual(expect.any(Array));
    expect(t2.introduced).toEqual(expect.any(Array));
  });

  it("residualChemistry reports survives/strengthens/introduces correctly", () => {
    const prev = [40, 60, 20, 10, 30, 10, 20, 30];
    const curr = [42, 62, 45, 55, 22, 12, 40, 35];
    const residual = residualChemistry(curr, prev);
    expect(residual.inherited).toEqual(expect.arrayContaining(["joy", "trust"]));
    expect(residual.strengthened).toEqual(expect.arrayContaining(["fear", "anger"]));
    expect(residual.introduced).toContain("surprise");
    expect(residual.reduced).toContain("sadness");
  });

  it("builds a full arc with consistent chemistry chain", () => {
    const genome = genomeOf(4);
    const slots = [];
    const roles = ["opener", "body", "body", "lift", "body", "climax", "descent", "body", "body", "closer"];
    roles.forEach((role, i) => slots.push({ index: i, roleId: role }));
    const arc = buildFullChemistryArc({
      genome,
      slots,
      climaxIndex: roles.indexOf("climax"),
      trackCount: roles.length,
      endTarget: genomeOf(0),
    });
    expect(arc).toHaveLength(10);
    arc.forEach((c, i) => {
      expect(c.values).toHaveLength(8);
      expect(c.purpose.length).toBeGreaterThan(3);
      expect(arc[i].inherited).toBeDefined();
    });
    // Later tracks inherit something from prior (chain is connected)
    expect(arc[1].inherited.length + arc[1].strengthened.length).toBeGreaterThan(0);
  });
});