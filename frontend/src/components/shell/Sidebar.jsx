import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/" || item.to === "."}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2.5 rounded-sm px-2.5 py-2 transition-[background,color] duration-200 ma-hairline border border-transparent",
          isActive
            ? "ma-panel text-slate-200 border-[var(--ma-line-strong)]"
            : "ma-faint hover:bg-white/5 hover:text-slate-200"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm">{item.label}</span>
      <span className="ml-auto h-3.5 w-0.5 rounded-full bg-[var(--ma-accent)] opacity-0 transition-opacity group-hover:opacity-50" />
    </NavLink>
  );
}

export default function Sidebar({ items, contextTitle, contextItems }) {
  const hasContext = Boolean(contextTitle && contextItems && contextItems.length > 0);
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r ma-hairline bg-[var(--ma-bg)]">
      <div className="px-4 pb-4 pt-5">
        <div className="px-2 text-[0.7rem] font-semibold uppercase tracking-[0.26em] ma-accent-text">
          Music Arcade
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        <div className="px-2 pb-1.5 pt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] ma-faint">
          Studio
        </div>
        {items.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </nav>

      {hasContext && (
        <nav className="border-t ma-hairline px-3 py-3" aria-label="Current album">
          <div className="px-2 pb-1.5 pt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] ma-faint">
            Current album
          </div>
          <div className="mb-2 px-2 text-sm font-medium text-white">{contextTitle}</div>
          <div className="space-y-0.5">
            {contextItems.map((item) => (
              <NavItem key={item.key} item={item} />
            ))}
          </div>
        </nav>
      )}

      <div className="border-t ma-hairline px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs ma-faint">Album engine</span>
          <span className="rounded-sm border ma-hairline-strong px-1.5 py-0.5 font-mono text-[0.65rem] ma-accent-text">
            v2.6
          </span>
        </div>
      </div>
    </aside>
  );
}