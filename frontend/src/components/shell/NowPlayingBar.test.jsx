import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { setTheaterContext, clearTheaterContext } from "@/lib/theaterContext";
import NowPlayingBar from "@/components/shell/NowPlayingBar";

function renderBar() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <NowPlayingBar />
    </MemoryRouter>
  );
}

describe("NowPlayingBar (8C)", () => {
  afterEach(() => {
    clearTheaterContext();
  });

  it("renders nothing when nothing is or was playing", () => {
    expect(renderBar()).toBe("");
  });

  it("shows the live track with a pause control", () => {
    setTheaterContext({
      playing: true,
      id: "T-001",
      title: "Ember",
      bpm: 122,
      artworkUrl: "/cover/T-001.webp",
      type: "library",
    });
    const markup = renderBar();
    expect(markup).toContain('aria-label="Now playing"');
    expect(markup).toContain(">Ember<");
    expect(markup).toContain("122 BPM");
    expect(markup).toContain('aria-label="Pause"');
  });

  it("shows a play control for a paused track", () => {
    setTheaterContext({
      playing: false,
      id: "T-002",
      title: "Wave",
      type: "library",
    });
    const markup = renderBar();
    expect(markup).toContain(">Wave<");
    expect(markup).toContain('aria-label="Play"');
  });

  it("disables skip when no studio page owns the transport", () => {
    setTheaterContext({ playing: true, id: "T-003", title: "Pulse", type: "library" });
    const markup = renderBar();
    expect(markup).toContain('aria-label="Skip to next track"');
    expect(markup).toContain('disabled');
  });

  it("renders the real waveform seek strip and live badge (8H)", () => {
    setTheaterContext({ playing: true, id: "T-004", title: "Flicker", bpm: 110, artworkUrl: "/cover/T-004.webp" });
    const markup = renderBar();
    expect(markup).toContain('data-testid="transport-waveform"');
    expect(markup).toContain('role="slider"');
    expect(markup).toContain(">Flicker<");
    expect(markup).toContain("Live");
  });

  it("keeps the expanded transport hidden on first paint (8H)", () => {
    setTheaterContext({ playing: true, id: "T-005", title: "Nova", type: "library" });
    expect(renderBar()).not.toContain("ma-transport-expanded");
  });
});