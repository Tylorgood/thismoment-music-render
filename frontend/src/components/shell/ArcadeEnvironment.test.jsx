import { renderToStaticMarkup } from "react-dom/server";
import { setTheaterContext, clearTheaterContext } from "@/lib/theaterContext";
import ArcadeEnvironment from "@/components/shell/ArcadeEnvironment";

describe("ArcadeEnvironment (Phase 8G)", () => {
  afterEach(() => {
    clearTheaterContext();
  });

  it("mounts a fixed, hidden environment canvas", () => {
    const markup = renderToStaticMarkup(<ArcadeEnvironment />);
    expect(markup).toContain("ma-arcade-environment");
    expect(markup).toContain("ma-arcade-env-canvas");
    expect(markup).toContain('data-react-live="false"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("ma-react-debug");
  });

  it("marks itself live while the theater is playing", () => {
    setTheaterContext({ playing: true, analysis: { bpm: 120, energy_label: "high" } });
    const markup = renderToStaticMarkup(<ArcadeEnvironment />);
    expect(markup).toContain('data-react-live="true"');
  });
});
