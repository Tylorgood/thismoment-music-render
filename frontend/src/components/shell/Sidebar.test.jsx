import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { PRIMARY_NAV, ALBUM_SECTIONS } from "@/lib/shellNav";

function html(element) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe("Sidebar", () => {
  it("renders the brand and primary sections", () => {
    const markup = html(<Sidebar items={PRIMARY_NAV} />);
    expect(markup).toContain("Music Arcade");
    ["Home", "Library", "Albums", "DJ", "Create"].forEach((label) => {
      expect(markup).toContain(`>${label}<`);
    });
  });

  it("hides the current-album group when no context is provided", () => {
    const markup = html(<Sidebar items={PRIMARY_NAV} />);
    expect(markup).not.toContain("Current album");
  });

  it("shows the current-album group with sections when context is provided", () => {
    const markup = html(
      <Sidebar items={PRIMARY_NAV} contextTitle="Love" contextItems={ALBUM_SECTIONS} />
    );
    expect(markup).toContain("Current album");
    expect(markup).toContain(">Love<");
    expect(markup).toContain("Production");
    expect(markup).toContain("Journey");
  });
});