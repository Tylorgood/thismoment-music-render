import { buildTempoTrajectory, TEMPO_OPTIONS } from "./albumTempo";

describe("albumTempo", () => {
  it("locks a fixed genre tempo unconditionally", () => {
    const dnb = buildTempoTrajectory({ baseBpm: 174, genre: { bpm: 174 }, trackCount: 10, behavior: "rise" });
    expect(new Set(dnb)).toEqual(new Set([174]));
  });

  it("rise monotonically increases toward the finish", () => {
    const ts = buildTempoTrajectory({ baseBpm: 100, genre: {}, trackCount: 10, behavior: "rise" });
    let prev = ts[0];
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThanOrEqual(prev);
      prev = ts[i];
    }
    expect(ts[ts.length - 1]).toBeGreaterThan(ts[0]);
  });

  it("fall monotonically decreases", () => {
    const ts = buildTempoTrajectory({ baseBpm: 100, genre: {}, trackCount: 10, behavior: "fall" });
    let prev = ts[0];
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeLessThanOrEqual(prev);
      prev = ts[i];
    }
  });

  it("wave rises and falls (two or more changes of direction)", () => {
    const ts = buildTempoTrajectory({ baseBpm: 100, genre: {}, trackCount: 12, behavior: "wave" });
    let dirChanges = 0;
    for (let i = 1; i < ts.length - 1; i++) {
      const up1 = ts[i] > ts[i - 1];
      const up2 = ts[i + 1] > ts[i];
      if (up1 !== up2) dirChanges += 1;
    }
    expect(dirChanges).toBeGreaterThanOrEqual(2);
  });

  it("peak-release puts its peak on / near the climax track", () => {
    const ts = buildTempoTrajectory({ baseBpm: 100, genre: {}, trackCount: 10, behavior: "peak-release", climaxIndex: 7 });
    expect(ts.indexOf(Math.max(...ts))).toBe(7);
  });

  it("keeps everything inside 60..210 and steps of 5", () => {
    for (const behavior of TEMPO_OPTIONS.map((o) => o.id)) {
      const ts = buildTempoTrajectory({ baseBpm: 112, genre: {}, trackCount: 11, behavior, seed: 7, climaxIndex: 8 });
      ts.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(60);
        expect(v).toBeLessThanOrEqual(210);
        expect(v % 5).toBe(0);
      });
    }
  });

  it("is deterministic per behavior+seed", () => {
    const a = buildTempoTrajectory({ baseBpm: 112, genre: {}, trackCount: 11, behavior: "free-form", seed: 3 });
    const b = buildTempoTrajectory({ baseBpm: 112, genre: {}, trackCount: 11, behavior: "free-form", seed: 3 });
    expect(a).toEqual(b);
  });
});