import { PRIMARY_NAV, ALBUM_SECTIONS, routeToBreadcrumbs } from "./shellNav";

describe("shellNav", () => {
  it("defines the primary studio sections", () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      "Home",
      "Library",
      "Albums",
      "DJ",
      "Create",
    ]);
  });

  it("defines the six album builder sections", () => {
    expect(ALBUM_SECTIONS.map((item) => item.label)).toEqual([
      "Overview",
      "Blueprint",
      "Tracks",
      "Journey",
      "Production",
      "Export",
    ]);
  });

  it("resolves a breadcrumb root for Home", () => {
    expect(routeToBreadcrumbs("/")).toEqual([{ label: "Home", to: "/" }]);
  });

  it("resolves Library under Home", () => {
    expect(routeToBreadcrumbs("/music")).toEqual([
      { label: "Home", to: "/" },
      { label: "Library", to: "/music" },
    ]);
  });

  it("resolves Albums under Home", () => {
    expect(routeToBreadcrumbs("/albums")).toEqual([
      { label: "Home", to: "/" },
      { label: "Albums", to: "/albums" },
    ]);
  });

  it("resolves nested album breadcrumbs (album + section)", () => {
    expect(routeToBreadcrumbs("/albums/love/production")).toEqual([
      { label: "Home", to: "/" },
      { label: "Albums", to: "/albums" },
      { label: "love", to: "/albums/love" },
      { label: "production", to: "/albums/love/production" },
    ]);
  });
});