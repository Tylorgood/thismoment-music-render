import { createDjEngine } from "./djEngine";

const param = () => ({ value: 0, setTargetAtTime: jest.fn(), setValueAtTime: jest.fn(), setValueCurveAtTime: jest.fn(), cancelScheduledValues: jest.fn() });
class FakeContext {
  currentTime = 10;
  destination = {};
  createGain() { return { gain: param(), connect: (node) => node }; }
  createDynamicsCompressor() {
    return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: (node) => node };
  }
  createBiquadFilter() { return { frequency: param(), Q: param(), gain: param(), connect: (node) => node }; }
  createMediaElementSource() { return { connect: jest.fn() }; }
}

beforeEach(() => { window.AudioContext = FakeContext; });
afterEach(() => { delete window.AudioContext; });

test.each([[0, 1], [1, 0]])("schedules equal-power gains on both decks (%s to %s)", (from, to) => {
  const engine = createDjEngine();
  const a = engine.connectElement("A", {});
  const b = engine.connectElement("B", {});
  const fade = engine.scheduleCrossfade(from, to, 4);
  const curveA = a.gain.gain.setValueCurveAtTime.mock.calls[0][0];
  const curveB = b.gain.gain.setValueCurveAtTime.mock.calls[0][0];
  expect(curveA[0]).toBeCloseTo(1 - from);
  expect(curveA[128]).toBeCloseTo(1 - to);
  for (let i = 0; i < 129; i += 1) expect(curveA[i] ** 2 + curveB[i] ** 2).toBeCloseTo(1, 5);
  a.context.currentTime = 12;
  expect(fade.progress()).toBe(0.5);
  a.context.currentTime = 100;
  expect(fade.progress()).toBe(1);
});

test("manual takeover cancels both scheduled curves", () => {
  const engine = createDjEngine();
  const a = engine.connectElement("A", {});
  const b = engine.connectElement("B", {});
  engine.scheduleCrossfade(0, 1, 4);
  a.context.currentTime = 11;
  engine.setCrossfader(0);
  for (const graph of [a, b]) expect(graph.gain.gain.cancelScheduledValues).toHaveBeenLastCalledWith(11);
  expect(a.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 11, 0.015);
});
