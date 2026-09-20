import { renderToStaticMarkup } from "react-dom/server";
import AlbumJourney from "@/components/AlbumJourney";

const journey = {
  slots: [
    {
      index: 0,
      title: "Opener",
      intensity: 40,
      role: "opener",
      roleLabel: "Opener",
      chemistry: {
        values: [10, 20, 30, 40, 50, 60, 70, 80],
        inherited: [],
        strengthened: [],
        reduced: [],
        introduced: [],
        activation: 1,
        intensity: 40,
        zeroDistance: 1,
        purpose: "Sets the scene",
      },
    },
  ],
  climaxIndex: 0,
  trackCount: 1,
  explanations: [{ job: "j", inherits: "i", changes: "c", movesNext: "m" }],
  peakIntensity: 40,
  bpmRange: [90, 90],
  tempo: [90],
};

describe("AlbumJourney (8D escalation)", () => {
  it("renders the color-fade path and tempo beat marks", () => {
    const markup = renderToStaticMarkup(<AlbumJourney journey={journey} />);
    expect(markup).toContain("Album journey");
    expect(markup).toContain("ma-journey-fade");
    expect(markup).toContain("journey-beat-marks");
    expect(markup).toContain("Pulse trajectory");
  });
});
