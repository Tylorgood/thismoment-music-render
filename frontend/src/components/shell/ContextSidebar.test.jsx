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
});