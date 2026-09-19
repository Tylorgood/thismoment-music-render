import {
  adopt,
  detach,
  getLive,
  getLiveMeta,
  forcePublish,
  toggle,
  skipNext,
  seekBy,
  hasControls,
  sampleEq,
  registerPageControl,
  clearPageControl,
  setPublishHook,
  resetSession,
} from "@/lib/persistAudio";
import { clearTheaterContext, getTheaterContext } from "@/lib/theaterContext";

function fakeAudio({ paused = true, currentTime = 0, duration = 120, ended = false } = {}) {
  const audio = {
    paused,
    currentTime,
    duration,
    ended,
    play() {
      this.paused = false;
      this.ended = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
  return audio;
}

describe("persistAudio (8C transport)", () => {
  beforeEach(() => {
    resetSession();
    clearTheaterContext();
  });

  afterAll(() => {
    resetSession();
  });

  it("starts with no live session", () => {
    expect(getLive()).toBeNull();
    expect(getLiveMeta()).toBeNull();
    expect(sampleEq()).toHaveLength(5);
    expect(sampleEq().every((level) => level > 0)).toBe(true);
  });

  it("adopts an element and preserves its metadata", () => {
    const audio = fakeAudio({ paused: false });
    adopt(audio, { trackId: "T-001", title: "Ember", bpm: 122 });
    expect(getLive()).toBe(audio);
    expect(getLiveMeta()).toEqual({ trackId: "T-001", title: "Ember", bpm: 122 });
  });

  it("publishes a bounded payload into the theater context", () => {
    const audio = fakeAudio({ paused: true });
    adopt(audio, { trackId: "T-002", title: "Wave", bpm: 98 });
    const state = getTheaterContext();
    expect(state.playing).toBe(false);
    expect(state.title).toBe("Wave");
    expect(state.trackId).toBe("T-002");
    expect(Number.isFinite(Number(state.currentTime))).toBe(true);
    expect(Number.isFinite(Number(state.duration))).toBe(true);
  });

  it("routes native toggle when no page control is mounted", () => {
    const audio = fakeAudio({ paused: true });
    adopt(audio);
    toggle();
    expect(audio.paused).toBe(false);
    toggle();
    expect(audio.paused).toBe(true);
  });

  it("routes controls to the page control while mounted", () => {
    const calls = { toggle: 0, skip: 0, seek: 0 };
    const audio = fakeAudio({ paused: true });
    adopt(audio);
    registerPageControl({
      toggle: () => {
        calls.toggle += 1;
      },
      skipNext: () => {
        calls.skip += 1;
      },
      seek: () => {
        calls.seek += 1;
      },
    });
    expect(hasControls()).toBe(true);
    toggle();
    skipNext();
    seekBy(5);
    clearPageControl();
    expect(calls).toEqual({ toggle: 1, skip: 1, seek: 1 });
    expect(audio.paused).toBe(true);
    expect(hasControls()).toBe(false);
  });

  it("forces an equatorial-style bounded sample, never NaN", () => {
    const audio = fakeAudio({ paused: false });
    adopt(audio, { bpm: 120 });
    const levels = Array.from({ length: 40 }, () => sampleEq());
    levels.forEach((row) => {
      expect(row).toHaveLength(5);
      row.forEach((level) => {
        expect(Number.isFinite(level)).toBe(true);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
      });
    });
  });

  it("routes publish through an optional hook", () => {
    const seen = [];
    setPublishHook((payload) => seen.push(payload));
    forcePublish();
    adopt(fakeAudio({ paused: false }), { trackId: "T-003", title: "Pulse" });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].title).toBe("Pulse");
    setPublishHook(null);
  });

  it("detach clears the live session", () => {
    const audio = fakeAudio({ paused: false });
    adopt(audio, { title: "Gone" });
    detach();
    expect(getLive()).toBeNull();
    expect(getLiveMeta()).toBeNull();
  });
});