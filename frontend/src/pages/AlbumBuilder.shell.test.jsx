import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { setAlbumContext } from "@/lib/albumContext";
import AppShell from "@/components/shell/AppShell";
import AlbumHome from "@/pages/AlbumHome";
import AlbumBuilder from "@/pages/AlbumBuilder";

describe("Albums + Album Builder on the shell", () => {
  afterEach(() => {
    setAlbumContext(null);
  });

  it("renders the Albums home with metrics and empty state inside the shell", () => {
    expect(() =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={["/albums"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/albums" element={<AlbumHome />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    ).not.toThrow();

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/albums"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/albums" element={<AlbumHome />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(markup).toContain("Music Arcade");
    expect(markup).toContain("Loading albums");
  });

  it("renders the Album Builder loading state with all six section nav items", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/albums/project-1/overview"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/albums/:id" element={<AlbumBuilder />} />
            <Route path="/albums/:id/:section" element={<AlbumBuilder />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(markup).toContain("Loading album");
    ["Overview", "Blueprint", "Tracks", "Journey", "Production", "Export"].forEach((label) => {
      expect(markup).toContain(`>${label}<`);
    });
  });

  it("renders the current-album context rail when the builder sets it", () => {
    setAlbumContext({ id: "project-1", name: "Love", status: "draft" });
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/albums/project-1/overview"]}>
        <AppShell />
      </MemoryRouter>
    );
    expect(markup).toContain("Current album");
    expect(markup).toContain(">Love<");
    expect(markup).toContain(`/albums/project-1/blueprint`);
  });

  it("hides the current-album rail without context", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/music"]}>
        <AppShell />
      </MemoryRouter>
    );
    expect(markup).not.toContain("Current album");
  });
});