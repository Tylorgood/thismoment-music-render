import { cn } from "@/lib/utils";

export default function DetailPanel({ title, description, actions, children, bodyClassName, className }) {
  return (
    <div className={cn("min-w-0 overflow-hidden border ma-hairline bg-[var(--ma-surface-1)]", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b ma-hairline bg-[var(--ma-surface-2)]/60 px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200">{title}</div>
            {description && <div className="mt-0.5 text-xs ma-muted">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}