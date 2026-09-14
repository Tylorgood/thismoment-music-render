import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppShell from "@/components/shell/AppShell";
import MusicLibrary from "@/pages/MusicLibrary";

describe("MusicLibrary on the shell", () => {
  it("renders the full Library inside the shell chrome without crashing", () => {
    expect(() =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={["/music"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/music" element={<MusicLibrary />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  it("keeps the DJ console and playlist markup intact inside the shell", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/music"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/music" element={<MusicLibrary />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(markup).toContain("Music Arcade");
    expect(markup).toContain("Smart flow");
    expect(markup).toContain("Playlists");
  });
});