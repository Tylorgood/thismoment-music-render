import { renderToStaticMarkup } from "react-dom/server";
import AlbumProduction from "@/components/AlbumProduction";

const blueprint = {
  slots: [
    { title: "Ember", role: "opener", roleLabel: "Opener", bpm: 120 },
    { title: "Oath", role: "climax", roleLabel: "Climax", bpm: 100 },
  ],
};

const production = {
  status: "draft",
  slots: {
    0: { status: "accepted", library_track_id: "t1" },
    1: { status: "generated", suno_url: "https://suno.com/s/1" },
  },
};

describe("AlbumProduction (Phase 5 rework)", () => {
  it("renders the DataTable anatomy with slot rows and contextual actions", () => {
    const markup = renderToStaticMarkup(
      <AlbumProduction
        blueprint={blueprint}
        production={production}
        onChange={() => {}}
        onFinish={() => {}}
        onExport={() => {}}
      />
    );
    expect(markup).toContain("Production workflow");
    expect(markup).toContain(">Slot<");
    expect(markup).toContain(">Track<");
    expect(markup).toContain(">Compare<");
    expect(markup).toContain(">Source<");
    expect(markup).toContain(">Ember<");
    expect(markup).toContain("Opener · 120 BPM target");
    expect(markup).toContain(">Oath<");
    expect(markup).toContain("1/2");
    expect(markup).toContain(">Accepted 1<");
    expect(markup).toContain(">Finish album<");
    expect(markup).toContain(">Manifest<");
  });

  it("shows an accepted take as a source chip and finishes when all accepted", () => {
    const finished = {
      status: "finished",
      slots: {
        0: { status: "accepted", library_track_id: "t1" },
        1: { status: "accepted", library_track_id: "t2" },
      },
    };
    const markup = renderToStaticMarkup(
      <AlbumProduction
        blueprint={blueprint}
        production={finished}
        onChange={() => {}}
        onFinish={() => {}}
        onExport={() => {}}
      />
    );
    expect(markup).toContain(">2/2<");
    expect(markup).toContain(">Album finished<");
    expect(markup).not.toContain("Accept take");
  });
});