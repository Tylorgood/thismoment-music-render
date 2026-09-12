import { remainingPlaybackSeconds, startDeckTransition } from "./deckTransition";

class FakeAudio extends EventTarget {
  constructor(readyState = 4) {
    super();
    Object.assign(this, { readyState, duration: 100, currentTime: 90, playbackRate: 1, paused: false, volume: 1, seeking: false });
    this.play = jest.fn(async () => { this.paused = false; });
    this.pause = jest.fn(() => { this.paused = true; });
  }
}

const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function setup(overrides = {}) {
  const outgoing = new FakeAudio();
  const incoming = new FakeAudio();
  incoming.currentTime = 0;
  incoming.paused = true;
  let progress = 0;
  const engine = {
    resume: jest.fn(async () => {}),
    scheduleCrossfade: jest.fn(() => ({ progress: () => progress })),
    cancelCrossfade: jest.fn(),
    setCrossfader: jest.fn(),
  };
  const args = { outgoing, incoming, engine, from: 0, to: 1, seconds: 4,
    onStart: jest.fn(), onComplete: jest.fn(), onError: jest.fn(), ...overrides };
  return { ...args, args, finish: () => { progress = 1; jest.advanceTimersByTime(50); } };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test("consecutive handoffs leave the outgoing song playing until the audio clock completes", async () => {
  let live = new FakeAudio();
  for (let index = 0; index < 4; index += 1) {
    const mix = setup({ outgoing: live, from: index % 2, to: 1 - index % 2 });
    startDeckTransition(mix.args);
    jest.advanceTimersByTime(0);
    await flush();
    expect(live.paused).toBe(false);
    expect(mix.incoming.paused).toBe(false);
    // Even late UI timers cannot finish a fade whose audio clock hasn't advanced.
    jest.advanceTimersByTime(12000);
    expect(mix.onComplete).not.toHaveBeenCalled();
    expect(live.paused).toBe(false);
    mix.incoming.currentTime = 4.2;
    mix.finish();
    expect(mix.onComplete).toHaveBeenCalledTimes(1);
    expect(live.paused).toBe(true);
    expect(mix.incoming.currentTime).toBe(4.2);
    expect(mix.incoming.play).toHaveBeenCalledTimes(1);
    live = mix.incoming;
  }
});

test("slow loading never starts the outgoing fade early or starts twice", async () => {
  const mix = setup({ incoming: new FakeAudio(1) });
  startDeckTransition(mix.args);
  jest.advanceTimersByTime(4000);
  await flush();
  expect(mix.engine.scheduleCrossfade).not.toHaveBeenCalled();
  expect(mix.outgoing.paused).toBe(false);
  mix.incoming.readyState = 4;
  mix.incoming.dispatchEvent(new Event("canplay"));
  mix.incoming.dispatchEvent(new Event("canplay"));
  jest.advanceTimersByTime(0);
  await flush();
  expect(mix.incoming.play).toHaveBeenCalledTimes(1);
  mix.finish();
});

test("short outgoing runway accounts for playback speed and skips beat waiting", async () => {
  const mix = setup({ beatDelay: () => 800 });
  mix.outgoing.currentTime = 98;
  mix.outgoing.playbackRate = 2;
  expect(remainingPlaybackSeconds(mix.outgoing)).toBe(1);
  startDeckTransition(mix.args);
  jest.advanceTimersByTime(0);
  await flush();
  expect(mix.engine.scheduleCrossfade).toHaveBeenCalledWith(0, 1, 0.85);
  mix.finish();
});

test("a rejected incoming play keeps the outgoing song alive", async () => {
  const mix = setup();
  mix.incoming.play.mockRejectedValueOnce(new Error("network"));
  startDeckTransition(mix.args);
  jest.advanceTimersByTime(0);
  await flush();
  expect(mix.outgoing.paused).toBe(false);
  expect(mix.engine.scheduleCrossfade).not.toHaveBeenCalled();
  expect(mix.engine.setCrossfader).toHaveBeenLastCalledWith(0);
  expect(mix.onError).toHaveBeenCalledTimes(1);
});

test("cancelling a pending beat prevents stale playback", async () => {
  const mix = setup({ beatDelay: () => 500 });
  const cancel = startDeckTransition(mix.args);
  cancel();
  jest.advanceTimersByTime(30000);
  await flush();
  expect(mix.incoming.play).not.toHaveBeenCalled();
  expect(mix.outgoing.paused).toBe(false);
  expect(mix.onComplete).not.toHaveBeenCalled();
});

test("cancelling while play is pending cannot resurrect the incoming song", async () => {
  const mix = setup();
  let resolvePlay;
  mix.incoming.play.mockImplementation(() => new Promise((resolve) => { resolvePlay = resolve; }));
  const cancel = startDeckTransition(mix.args);
  jest.advanceTimersByTime(0);
  await flush();
  cancel();
  resolvePlay();
  await flush();
  expect(mix.incoming.paused).toBe(true);
  expect(mix.engine.scheduleCrossfade).not.toHaveBeenCalled();
  expect(mix.onComplete).not.toHaveBeenCalled();
});

test("unavailable incoming media times out without stopping the live song", () => {
  const mix = setup({ incoming: new FakeAudio(0) });
  startDeckTransition(mix.args);
  jest.advanceTimersByTime(20000);
  expect(mix.outgoing.paused).toBe(false);
  expect(mix.onError).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("streaming media can use the library duration before the browser knows its length", async () => {
  const mix = setup({ outgoingDuration: 100 });
  mix.outgoing.duration = Infinity;
  expect(remainingPlaybackSeconds(mix.outgoing, 100)).toBe(10);
  expect(remainingPlaybackSeconds(mix.outgoing)).toBe(Infinity);
  startDeckTransition(mix.args);
  jest.advanceTimersByTime(0);
  await flush();
  expect(mix.engine.scheduleCrossfade).toHaveBeenCalledWith(0, 1, 4);
  mix.finish();
});
