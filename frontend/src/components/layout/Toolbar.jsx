import { cn } from "@/lib/utils";

export default function Toolbar({ left, right, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b ma-hairline bg-[var(--ma-surface-2)]/40 px-4 py-2",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}