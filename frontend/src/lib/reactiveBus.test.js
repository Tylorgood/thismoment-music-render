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
