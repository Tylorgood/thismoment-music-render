import { createProjectVocabulary, hashString } from "./titleVocabulary";

describe("titleVocabulary (plot-first world)", () => {
  it("builds a world even with no theme hooks", () => {
    const vocab = createProjectVocabulary({ theme: "", templateName: "Northern Orbits", genreLabel: "Ambient", trackCount: 10, seedBase: 0 });
    expect(vocab.world.length).toBeGreaterThan(0);
    expect(vocab.artifacts.length).toBeGreaterThanOrEqual(10);
  });

  it("picks thematic families when the narrative matches", () => {
    const vocab = createProjectVocabulary({ theme: "driving through the rain at midnight", templateName: "", genreLabel: "", trackCount: 10, seedBase: 1 });
    const names = vocab.world.map((w) => w.name);
    expect(names).toContain("weather");
  });

  it("never repeats a title across the album", () => {
    for (let seedBase = 0; seedBase < 5; seedBase += 1) {
      const vocab = createProjectVocabulary({ theme: "letters left ungiven under the overpass", templateName: "Afterimages", genreLabel: "Downtempo", trackCount: 12, seedBase });
      const titles = [];
      for (let i = 0; i < 12; i += 1) {
        const t = vocab.title(i, 0);
        expect(t).toBeTruthy();
        expect(t.length).toBeGreaterThan(2);
        titles.push(t);
      }
      expect(new Set(titles).size).toBe(12);
    }
  });

  it("title re-rolls without collisions across variant seeds", () => {
    const vocab = createProjectVocabulary({ theme: "a slow burn that outlives the summer", templateName: "", genreLabel: "", trackCount: 10, seedBase: 7 });
    const a = vocab.artifacts;
    const b = [];
    for (let i = 0; i < 10; i += 1) b.push(vocab.title(i, 3));
    expect(new Set(b).size).toBe(10);
    // same set of artifacts, shuffled for the variant
    expect(a.length).toBe(10);
    expect(b.every((t) => a.includes(t))).toBe(true);
  });

  it("respects dominant-world references (no obvious theme-word insertion)", () => {
    const vocab = createProjectVocabulary({ theme: "flight over gravity, orbit and fall", templateName: "", genreLabel: "", trackCount: 10, seedBase: 11 });
    for (let i = 0; i < 10; i += 1) {
      const t = vocab.title(i, 0).toLowerCase();
      expect(t).not.toContain("flight over gravity");
    }
  });

  it("hashString is deterministic and changes with input", () => {
    expect(hashString("x")).toBe(hashString("x"));
    expect(hashString("x")).not.toBe(hashString("y"));
  });
});