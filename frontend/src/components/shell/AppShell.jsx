import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import ShellBreadcrumbs from "@/components/shell/ShellBreadcrumbs";
import CommandPalette from "@/components/shell/CommandPalette";
import ContextSidebar from "@/components/shell/ContextSidebar";
import { PRIMARY_NAV, ALBUM_SECTIONS, routeToBreadcrumbs } from "@/lib/shellNav";
import { listProjects, getProjectToken } from "@/lib/albumProjects";
import { useAlbumContext } from "@/lib/albumContext";
import { setTheaterContext } from "@/lib/theaterContext";
import { Disc3, Music2, Sparkles } from "lucide-react";

const PALETTE_GROUPS = [
  {
    label: "Actions",
    items: [
      { id: "act:album", label: "Create album", keywords: ["album", "make", "new"], icon: Disc3, to: "/create" },
      { id: "act:set", label: "Build DJ set", keywords: ["set", "dj", "play"], icon: Music2, to: "/dj" },
      { id: "act:studio", label: "Open prompt studio", keywords: ["studio", "prompt", "blueprint"], icon: Sparkles, to: "/prompts" },
    ],
  },
];

export default function AppShell() {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [albums, setAlbums] = useState(null);
  const albumContext = useAlbumContext();

  const crumbs = routeToBreadcrumbs(location.pathname);

  const section = crumbs[crumbs.length - 1];

  useEffect(() => {
    setTheaterContext((current) => ({
      ...(current || {}),
      albumName: albumContext?.name,
      section: albumContext?.id ? (section?.label || "Overview") : undefined,
    }));
    return () => {
      setTheaterContext((current) => {
        if (!current?.albumName) return current;
        const next = { ...current };
        delete next.albumName;
        delete next.section;
        return next;
      });
    };
  }, [albumContext?.id, albumContext?.name, section?.label]);

  const contextItems = albumContext?.id
    ? ALBUM_SECTIONS.map((section) => ({
        ...section,
        to:
          section.key === "overview"
            ? `/albums/${albumContext.id}`
            : `/albums/${albumContext.id}/${section.key}`,
      }))
    : null;

  useEffect(() => {
    if (!paletteOpen) return;
    let cancelled = false;
    if (!getProjectToken()) {
      setAlbums([]);
      return;
    }
    listProjects()
      .then((list) => {
        if (!cancelled) setAlbums(list || []);
      })
      .catch(() => {
        if (!cancelled) setAlbums([]);
      });
    return () => {
      cancelled = true;
    };
  }, [paletteOpen]);

  const handleKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setPaletteOpen((open) => !open);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex min-h-screen bg-[var(--ma-chrome)] text-slate-100">
      <Sidebar
        items={PRIMARY_NAV}
        contextTitle={albumContext?.name ?? undefined}
        contextItems={contextItems}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b ma-hairline bg-[var(--ma-surface-1)] px-5">
          <ShellBreadcrumbs crumbs={crumbs} />
          <button
            onClick={() => setPaletteOpen(true)}
            className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-2.5 py-1.5 text-sm ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="rounded-sm border ma-hairline px-1 font-mono text-[0.65rem] ma-faint">
              ⌘K
            </kbd>
          </button>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <ContextSidebar />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={PALETTE_GROUPS}
        albums={albums || []}
      />
    </div>
  );
}