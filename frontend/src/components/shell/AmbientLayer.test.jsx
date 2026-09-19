import { renderToStaticMarkup } from "react-dom/server";
import { setTheaterContext, clearTheaterContext } from "@/lib/theaterContext";
import AmbientLayer from "@/components/shell/AmbientLayer";

describe("AmbientLayer (Phase 8A)", () => {
  afterEach(() => {
    clearTheaterContext();
  });

  function orbCount(markup) {
    return (markup.match(/ma-ambient-orb\s/g) || []).length;
  }

  it("renders a fixed neutral room when nothing is playing", () => {
    const markup = renderToStaticMarkup(<AmbientLayer />);
    expect(markup).toContain("ma-ambient-layer");
    expect(markup).toContain('data-ambient-source="neutral"');
    expect(markup).toContain('data-ambient-mode="dark"');
    expect(markup).toContain('data-ambient-intensity="0.00"');
    expect(markup).toContain('aria-hidden="true"');
    expect(orbCount(markup)).toBe(3);
    expect(markup).not.toContain("ma-ambient-debug");
  });

  it("does not crash when theater carries track data", () => {
    setTheaterContext({
      playing: true,
      id: "T-001",
      title: "Ember",
      bpm: 122,
      artworkUrl: "/cover/T-001.webp",
      analysis: { status: "complete", energy_label: "high", bpm: 122, key: "Dm", beat_confidence: 0.8 },
      type: "library",
    });
    const markup = renderToStaticMarkup(<AmbientLayer />);
    expect(markup).toContain("ma-ambient-layer");
  });
});