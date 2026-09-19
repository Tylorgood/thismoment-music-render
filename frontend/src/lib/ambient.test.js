import {
  clamp01,
  hexToRgb,
  luminance,
  saturation,
  darken,
  lighten,
  rgbTriplet,
  lerpRgb,
  pickEmotionColor,
  energyFromLabel,
  pickFromAnalysis,
  sortGlow,
  buildAmbient,
  modeFor,
  intensityFor,
  analysisKey,
  readArtworkPalette,
  clearArtworkPaletteCache,
  neutralAmbient,
} from "@/lib/ambient";

describe("ambient color math", () => {
  it("parses 3 and 6 digit hex and rejects garbage", () => {
    expect(hexToRgb("#0a0a0a")).toEqual([10, 10, 10]);
    expect(hexToRgb("#08F")).toEqual([0, 136, 255]);
    expect(hexToRgb("zzz")).toBeNull();
    expect(hexToRgb(null)).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });

  it("computes luminance and saturation", () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(255);
    expect(luminance([0, 0, 0])).toBeCloseTo(0);
    expect(saturation([255, 0, 0])).toBeCloseTo(1);
    expect(saturation([100, 100, 100])).toBeCloseTo(0);
  });

  it("darkens, lightens and clamps channels", () => {
    expect(darken([200, 200, 200], 0.5)).toEqual([100, 100, 100]);
    expect(lighten([100, 100, 100], 0.5)).toEqual([178, 178, 178]);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01("nope")).toBe(0);
  });

  it("interpolates between rgb colors and renders triplets", () => {
    expect(lerpRgb([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(rgbTriplet([10, 20, 30])).toBe("10 20 30");
    expect(pickEmotionColor(0)).toEqual([192, 132, 252]);
    expect(pickEmotionColor(1)).toEqual([244, 114, 182]);
  });
});

describe("analysis -> ambient", () => {
  it("maps energy labels to interpolation targets", () => {
    expect(energyFromLabel("high")).toBe(0.95);
    expect(energyFromLabel("low")).toBe(0.22);
    expect(energyFromLabel("Unknown")).toBeNull();
    expect(energyFromLabel(null)).toBeNull();
  });

  it("derives dim emotion colors from analysis and falls back to neutral", () => {
    const fromAnalysis = pickFromAnalysis({ energy_label: "low", bpm: 84, beat_confidence: 0.9 });
    expect(fromAnalysis.length).toBe(3);
    fromAnalysis.forEach((color) => {
      expect(Array.isArray(color)).toBe(true);
      color.forEach((channel) => expect(channel).toBeGreaterThanOrEqual(0));
    });
    expect(pickFromAnalysis(null)).toEqual(neutralAmbient());
    expect(pickFromAnalysis({})).toEqual(neutralAmbient());
  });

  it("builds normalized ambient snapshots", () => {
    const snap = buildAmbient({ source: "artwork", colors: [[255, 0, 0]], intensity: 4, mode: "stage" });
    expect(snap.source).toBe("artwork");
    expect(snap.colors.length).toBe(3);
    expect(snap.colors[0]).toEqual([255, 0, 0]);
    expect(snap.intensity).toBe(1);
    expect(snap.mode).toBe("stage");
    const fallback = buildAmbient({ source: "nonsense", colors: null, mode: "nope" });
    expect(fallback.source).toBe("neutral");
    expect(fallback.mode).toBe("dark");
    expect(fallback.colors.length).toBe(3);
  });

  it("sorts swatches glow-first", () => {
    const sorted = sortGlow([
      [10, 10, 10],
      [255, 255, 255],
    ]);
    expect(sorted[0]).toEqual([255, 255, 255]);
  });
});

describe("ambient mode and intensity", () => {
  it("selects mode by context", () => {
    expect(modeFor({ playing: true })).toBe("stage");
    expect(modeFor({ scene: true })).toBe("wait");
    expect(modeFor({})).toBe("dark");
  });

  it("scales intensity with energy and confidence", () => {
    expect(intensityFor({ playing: true, energyT: 0, confidence: 0 })).toBeCloseTo(0.55);
    expect(intensityFor({ playing: true, energyT: 1, confidence: 1 })).toBe(1);
    expect(intensityFor({ playing: false })).toBe(0.4);
  });

  it("produces stable keys that change with analysis", () => {
    expect(analysisKey(null)).toBe("none");
    expect(analysisKey({ energy_label: "high" })).not.toBe(analysisKey({ energy_label: "low" }));
  });
});

describe("artwork palette reader", () => {
  it("resolves null when no canvas/image environment exists", async () => {
    clearArtworkPaletteCache();
    const result = await readArtworkPalette("https://example.com/cover.jpg");
    expect(result).toBeNull();
  });

  it("caches by url and never recomputes", async () => {
    clearArtworkPaletteCache();
    const first = readArtworkPalette("https://example.com/cover.jpg");
    const second = readArtworkPalette("https://example.com/cover.jpg");
    expect(first).toBe(second);
    expect(await first).toBeNull();
    expect(await readArtworkPalette("")).toBeNull();
    expect(await readArtworkPalette(null)).toBeNull();
  });
});