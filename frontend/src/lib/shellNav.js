import {
  Home,
  Music2,
  Disc3,
  Disc,
  Sparkles,
  FileText,
  Compass,
} from "lucide-react";

export const PRIMARY_NAV = [
  { label: "Home", to: "/", icon: Home },
  { label: "Library", to: "/music", icon: Music2 },
  { label: "Albums", to: "/albums", icon: Disc3 },
  { label: "DJ", to: "/dj", icon: Disc },
  { label: "Create", to: "/create", icon: Sparkles },
];

export const ALBUM_SECTIONS = [
  { key: "overview", label: "Overview", to: ".", icon: FileText },
  { key: "blueprint", label: "Blueprint", to: "blueprint", icon: FileText },
  { key: "tracks", label: "Tracks", to: "tracks", icon: Music2 },
  { key: "journey", label: "Journey", to: "journey", icon: Compass },
  { key: "production", label: "Production", to: "production", icon: Disc },
  { key: "export", label: "Export", to: "export", icon: Sparkles },
];

export function routeToBreadcrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", to: "/" }];
  if (segments.length === 0) return crumbs;

  if (segments[0] === "music") {
    crumbs.push({ label: "Library", to: "/music" });
    return crumbs;
  }
  if (segments[0] === "prompts") {
    crumbs.push({ label: "Prompts", to: "/prompts" });
    return crumbs;
  }
  if (segments[0] === "albums") {
    crumbs.push({ label: "Albums", to: "/albums" });
    if (segments[1]) {
      crumbs.push({ label: segments[1], to: `/albums/${segments[1]}` });
    }
    if (segments[2]) {
      crumbs.push({ label: segments[2], to: `/albums/${segments[1]}/${segments[2]}` });
    }
    return crumbs;
  }
  if (segments[0] === "dj") {
    crumbs.push({ label: "DJ", to: "/dj" });
    return crumbs;
  }
  if (segments[0] === "create") {
    crumbs.push({ label: "Create", to: "/create" });
    return crumbs;
  }
  crumbs.push({ label: segments.join(" / "), to: "/" + segments.join("/") });
  return crumbs;
}