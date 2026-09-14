import { setAlbumContext, getAlbumContext, subscribeAlbumContext } from "./albumContext";

describe("albumContext", () => {
  afterEach(() => {
    setAlbumContext(null);
  });

  it("stores and returns the active album", () => {
    setAlbumContext({ id: "a1", name: "Love" });
    expect(getAlbumContext()).toEqual({ id: "a1", name: "Love" });
  });

  it("is null by default and clears to null", () => {
    expect(getAlbumContext()).toBeNull();
    setAlbumContext({ id: "a1", name: "Love" });
    setAlbumContext(null);
    expect(getAlbumContext()).toBeNull();
  });

  it("notifies subscribers and unsubscribes", () => {
    const seen = [];
    const unsubscribe = subscribeAlbumContext((next) => seen.push(next));
    setAlbumContext({ id: "a1", name: "Love" });
    expect(seen).toHaveLength(1);
    unsubscribe();
    setAlbumContext({ id: "a2", name: "Halo" });
    expect(seen).toHaveLength(1);
  });
});