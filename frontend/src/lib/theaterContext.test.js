import { setTheaterContext, getTheaterContext, subscribeTheaterContext, clearTheaterContext } from "./theaterContext";

describe("theaterContext", () => {
  afterEach(() => {
    clearTheaterContext();
  });

  it("stores and clears playing state", () => {
    expect(getTheaterContext()).toBeNull();
    setTheaterContext({ playing: true, title: "Ember" });
    expect(getTheaterContext().playing).toBe(true);
    clearTheaterContext();
    expect(getTheaterContext()).toBeNull();
  });

  it("notifies subscribers and unsubscribes", () => {
    const seen = [];
    const unsubscribe = subscribeTheaterContext((next) => seen.push(next));
    setTheaterContext({ playing: true });
    expect(seen).toHaveLength(1);
    unsubscribe();
    setTheaterContext({ playing: false });
    expect(seen).toHaveLength(1);
  });
});