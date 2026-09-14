import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, actions, tone = "neutral", className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border ma-hairline bg-[var(--ma-inset)]">
          <Icon className={cn("h-5 w-5", tone === "emotion" ? "ma-emotion-text" : "ma-faint")} />
        </div>
      )}
      <h3 className="text-base font-medium text-slate-200">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed ma-muted">{description}</p>
      {actions && <div className="mt-5 flex items-center gap-2">{actions}</div>}
    </div>
  );
}