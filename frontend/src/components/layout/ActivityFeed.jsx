import { cn } from "@/lib/utils";
import StatusBadge from "@/components/layout/StatusBadge";

export default function ActivityFeed({ events, className }) {
  return (
    <ol className={cn("space-y-0", className)}>
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <li key={event.key || index} className="relative flex gap-3 pb-4 last:pb-0">
            {index < events.length - 1 && (
              <span
                className="absolute left-[0.6875rem] top-5 h-[calc(100%-1.25rem)] w-px ma-hairline"
                aria-hidden="true"
              />
            )}
            <span className="mt-0.5 flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border ma-hairline bg-[var(--ma-inset)]">
              {Icon ? (
                <Icon className="h-3 w-3 ma-muted" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ma-line-strong)]" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-200">{event.title}</span>
                {event.time && <span className="shrink-0 font-mono text-xs ma-faint">{event.time}</span>}
              </div>
              {event.detail && <p className="mt-0.5 text-xs leading-relaxed ma-muted">{event.detail}</p>}
              {event.tone && (
                <div className="mt-1.5">
                  <StatusBadge tone={event.tone} label={event.tone === "ok" ? "OK" : event.label || event.tone} dot={false} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}