import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InspectorDrawer({ open, onClose, title, children, footer, side = "right", className }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--ma-z-drawer)]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute top-0 flex h-full w-[26rem] max-w-[90vw] flex-col border-l ma-hairline-strong bg-[var(--ma-surface-2)] shadow-2xl",
          side === "right" ? "right-0" : "left-0",
          className
        )}
      >
        <div className="flex items-center justify-between border-b ma-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close inspector"
            className="ma-ring-focus rounded-sm p-1.5 ma-muted hover:bg-white/5 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t ma-hairline px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}