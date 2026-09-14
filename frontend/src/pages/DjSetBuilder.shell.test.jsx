import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AppShell from "@/components/shell/AppShell";
import DjSetBuilder from "@/pages/DjSetBuilder";
import MusicLibrary from "@/pages/MusicLibrary";

describe("DJ Set Builder on the shell", () => {
  it("mounts the workstation focused on the performance view at /dj", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dj"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dj" element={<DjSetBuilder />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(markup).toContain("Music Arcade");
    expect(markup).toContain("dj-open");
    expect(markup).not.toContain("dj-closed");
    expect(markup).toContain("Performance");
  });

  it("keeps the plain library route in manual idle mode", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/music"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/music" element={<MusicLibrary />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(markup).toContain("dj-closed");
    expect(markup).not.toContain("dj-open");
  });
});