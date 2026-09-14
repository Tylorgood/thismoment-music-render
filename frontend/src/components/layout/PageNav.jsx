import { cn } from "@/lib/utils";

export default function PageNav({ items, activeKey, onSelect, className }) {
  return (
    <nav className={cn("flex items-center gap-1 border-b ma-hairline px-4", className)} aria-label="Page sections">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => onSelect?.(item.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "ma-ring-focus relative -mb-px px-3 py-2.5 text-sm transition-colors",
              active ? "text-slate-100" : "ma-muted hover:text-slate-200"
            )}
          >
            {item.label}
            <span
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity",
                active ? "bg-[var(--ma-accent)] opacity-100" : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}