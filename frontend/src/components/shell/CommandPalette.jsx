import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Disc3, Sparkles, ArrowRight } from "lucide-react";

export default function CommandPalette({ open, onOpenChange, items, albums }) {
  const navigate = useNavigate();

  const handleSelect = (item) => {
    if (item.to) navigate(item.to);
    if (item.run) item.run();
    onOpenChange(false);
  };

  const albumGroup = useMemo(
    () =>
      albums && albums.length > 0
        ? [
            {
              label: "Albums",
              items: albums.map((album) => ({
                id: `album:${album.id}`,
                label: album.name,
                keywords: [album.name, "album"],
                icon: Disc3,
                to: "/albums",
                shortcut: "saved",
              })),
            },
          ]
        : [],
    [albums]
  );

  const groups = [...items, ...albumGroup];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b ma-hairline px-3">
        <CommandInput placeholder="Search albums, songs, actions, templates…" />
        <CommandShortcut className="mr-1">ESC</CommandShortcut>
      </div>
      <CommandList>
        <CommandEmpty className="py-6 text-sm ma-muted">
          No results — try a different name.
        </CommandEmpty>
        {groups.map((group, gi) => (
          <div key={group.label}>
            <CommandGroup heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon || ArrowRight;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    keywords={item.keywords || []}
                    onSelect={() => handleSelect(item)}
                    className="ma-motive ma-motive-press"
                  >
                    <Icon className="mr-2 h-4 w-4 ma-muted" />
                    <span>{item.label}</span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {gi < groups.length - 1 && <CommandSeparator />}
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}