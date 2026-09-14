import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";

describe("AppShell", () => {
  it("renders the shell chrome with brand, sidebar and breadcrumbs", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/music"]}>
        <AppShell />
      </MemoryRouter>
    );
    expect(markup).toContain("Music Arcade");
    expect(markup).toContain("Library");
    expect(markup).toContain("⌘K");
    expect(markup).toContain("Album engine");
    expect(markup).toContain("Stage lights ready");
  });

  it("renders the shell chrome with album headings on stub routes", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/albums"]}>
        <AppShell />
      </MemoryRouter>
    );
    expect(markup).toContain("Albums");
    expect(markup).toContain("Search");
  });
});