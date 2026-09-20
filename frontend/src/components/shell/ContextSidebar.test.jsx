import { renderToStaticMarkup } from "react-dom/server";
import { setTheaterContext, getTheaterContext, clearTheaterContext } from "@/lib/theaterContext";
import ContextSidebar from "@/components/shell/ContextSidebar";

describe("ContextSidebar (Theater rail)", () => {
  afterEach(() => {
    clearTheaterContext();
  });

  it("renders the idle zero lights state", () => {
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(markup).toContain("ZERO");
    expect(markup).toContain("Stage lights ready");
  });

  it("lights up the now-playing row when a track is live", () => {
    setTheaterContext({ playing: true, id: "T-001", title: "Ember", bpm: 122, type: "library" });
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(getTheaterContext().playing).toBe(true);
    expect(markup).toContain(">Ember<");
    expect(markup).toContain("Now playing");
    expect(markup).toContain("T-001");
  });

  it("shows the album scene rail when album context is present", () => {
    setTheaterContext({ albumName: "Love", section: "Production" });
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(markup).toContain(">Love<");
    expect(markup).toContain("Album preview");
  });

  it("lights the rail marquee and tint when the stage is live (8D)", () => {
    setTheaterContext({ playing: true, id: "T-001", title: "Ember", bpm: 122, analysis: { energy_label: "high" } });
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(markup).toContain("ma-scene-rail");
    expect(markup).toContain('data-live="true"');
    expect(markup).toContain("ma-motive-marquee");
    expect(markup).toContain("NOW SHOWING");
    expect(markup).toContain("122 BPM");
    expect(markup).toContain("ma-scanline-live");
  });

  it("mounts the spectrum scope canvas and mood band when live (8H)", () => {
    setTheaterContext({ playing: true, id: "T-001", title: "Ember", bpm: 122 });
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(markup).toContain("ma-theater-scope");
    expect(markup).toContain("<canvas");
    expect(markup).toContain('data-testid="theater-mood"');
  });

  it("keeps the rail dark and ticker-free when idle (8D)", () => {
    const markup = renderToStaticMarkup(<ContextSidebar />);
    expect(markup).toContain('data-live="false"');
    expect(markup).not.toContain("ma-motive-marquee");
    expect(markup).not.toContain("ma-theater-scope");
    expect(markup).not.toContain('data-testid="theater-mood"');
  });
});