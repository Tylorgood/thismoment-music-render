import {
  BAND_RANGES,
  bandAverage,
  bandVector,
  clamp01,
  attachEngine,
  detachEngine,
  getState,
  getMetadata,
  setMetadata,
  resetForTests,
  spectrumVector,
  spectrumRanges,
  SPECTRUM_BUCKETS,
  deriveMood,
  MOOD_LABELS,
  __test,
} from "@/lib/reactiveBus";

const SR = 44100;
const SIZE = 2048;

function frameWithBins(ranges) {
  const data = new Uint8Array(SIZE / 2);
  const binHz = SR / SIZE;
  for (const [name, value] of Object.entries(ranges)) {
    const [lo, hi] = BAND_RANGES[name];
    const from = Math.max(1, Math.floor(lo / binHz));
    const to = Math.min(data.length - 1, Math.ceil(hi / binHz));
    for (let i = from; i <= to; i += 1) data[i] = value;
  }
  return data;
}

afterEach(() => {
  resetForTests();
});

describe("reactiveBus helpers (Phase 8G)", () => {
  it("clamps into 0..1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
    expect(clamp01("nope")).toBe(0);
  });

  it("reads a band average from the FFT frame", () => {
    const data = frameWithBins({ bass: 255 });
    expect(bandAverage(data, SR, SIZE, BAND_RANGES.bass)).toBeCloseTo(1, 5);
    expect(bandAverage(data, SR, SIZE, BAND_RANGES.mid)).toBeCloseTo(0, 5);
  });

  it("returns every band from one frame", () => {
    const data = frameWithBins({ low: 128, high: 255, air: 200 });
    const bands = bandVector(data, SR, SIZE);
    expect(Object.keys(bands).sort()).toEqual(["air", "bass", "high", "low", "mid"]);
    expect(bands.low).toBeCloseTo(128 / 255, 3);
    expect(bands.high).toBeGreaterThan(0.99);
    const silent = bandVector(frameWithBins({ air: 255 }), SR, SIZE);
    expect(silent.bass).toBeCloseTo(0, 5);
    expect(silent.mid).toBeCloseTo(0, 5);
    expect(silent.air).toBeCloseTo(1, 3);
  });

  it("smooths with distinct attack and release time constants", () => {
    const attack = __test.env(0, 1, 0.1, 0.05, 5);
    const release = __test.env(1, 0, 0.1, 0.05, 5);
    expect(attack).toBeGreaterThan(0.8);
    expect(release).toBeGreaterThan(attack);
    expect(release).toBeGreaterThan(0.9);
  });

  it("keeps slow layers slow and fast layers fast", () => {
    const times = __test.stepTimes;
    expect(times.mood).toBeGreaterThan(times.energy);
    expect(times.breathe).toBeGreaterThan(times.mid);
    expect(times.air).toBeLessThan(times.high);
  });

  it("records metadata for the visual subscribers", () => {
    setMetadata({ bpm: 128, energy_label: "high", playing: true });
    expect(getMetadata()).toMatchObject({ bpm: 128, energy_label: "high", playing: true });
  });
});

describe("reactiveBus engine tap", () => {
  function fakeEngine() {
    const analyser = {
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
    };
    const master = { connect: jest.fn(), disconnect: jest.fn() };
    const context = {
      sampleRate: SR,
      currentTime: 3,
      createAnalyser: () => analyser,
    };
    return { getContext: () => context, getMaster: () => master, __analyser: analyser, __master: master };
  }

  it("refuses engines it cannot tap", () => {
    expect(attachEngine(null)).toBe(false);
    expect(attachEngine({})).toBe(false);
  });

  it("hangs one analyser on the master bus", () => {
    const engine = fakeEngine();
    expect(attachEngine(engine)).toBe(true);
    expect(engine.__master.connect).toHaveBeenCalledWith(engine.__analyser);
    attachEngine(engine);
    expect(engine.__master.connect).toHaveBeenCalledTimes(1);
  });

  it("drops the tap on detach", () => {
    const engine = fakeEngine();
    attachEngine(engine);
    detachEngine();
    expect(engine.__master.disconnect).toHaveBeenCalledWith(engine.__analyser);
  });
});

describe("reactiveBus spectrum + mood (8H)", () => {
  it("builds log-spaced spectrum buckets from 20Hz to 16kHz", () => {
    const ranges = spectrumRanges();
    expect(ranges).toHaveLength(SPECTRUM_BUCKETS);
    expect(ranges[0][0]).toBeCloseTo(20, 0);
    expect(ranges[SPECTRUM_BUCKETS - 1][1]).toBeCloseTo(16000, 0);
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][0]);
    }
  });

  it("vectorizes one FFT frame into the spectrum", () => {
    const data = frameWithBins({ bass: 255, low: 200, mid: 128, high: 64, air: 255 });
    const vec = spectrumVector(data, SR, SIZE);
    expect(vec).toHaveLength(26);
    expect(Math.max(...vec)).toBeCloseTo(1, 3);
    const silent = spectrumVector(frameWithBins({ air: 255 }), SR, SIZE);
    expect(silent[0]).toBeCloseTo(0, 5);
    expect(silent[10]).toBeCloseTo(0, 5);
    expect(Math.max(...silent)).toBeCloseTo(1, 3);
  });

  it("exposes spectrum buckets and a neutral mood in reset state", () => {
    resetForTests();
    expect(getState().spectrum).toHaveLength(26);
    expect(getState().spectrum.every((value) => value === 0)).toBe(true);
    expect(getState().moodLabel).toBeNull();
  });

  it("derives the intended mood archetype from matching signals", () => {
    const excited = deriveMood({
      energy: 0.95,
      bass: 0.7,
      mid: 0.55,
      air: 0.7,
      transientDensity: 0.8,
      sustain: 0.9,
      zeroDistance: 0.5,
      emotion: 0.85,
    });
    expect(excited.label).toBe("HIGHER STATE");
    const quiet = deriveMood({
      energy: 0.2,
      bass: 0.3,
      mid: 0.4,
      air: 0.2,
      transientDensity: 0.08,
      sustain: 0.1,
      zeroDistance: 0.35,
      emotion: 0.3,
    });
    expect(quiet.label).toBe("JUST MUSIC");
  });

  it("holds the previous mood while the signal is ambiguous", () => {
    const ambiguous = deriveMood(
      {
        energy: 0.99,
        bass: 0.99,
        mid: 0.99,
        air: 0.99,
        transientDensity: 0,
        sustain: 0.99,
        zeroDistance: 0.99,
        emotion: 0.99,
      },
      "FLOW"
    );
    expect(ambiguous.confidence).toBeLessThan(0.55);
    expect(ambiguous.label).toBe("FLOW");
  });

  it("offers every mood archetype as a real state", () => {
    expect(MOOD_LABELS).toEqual(["IMMERSION", "CREATIVITY", "FLOW", "HIGHER STATE", "JUST MUSIC"]);
  });
});
