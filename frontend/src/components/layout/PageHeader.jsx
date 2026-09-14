import { cn } from "@/lib/utils";

export default function PageHeader({ title, subtitle, children, className }) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 border-b ma-hairline px-6 pb-4 pt-5",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm ma-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}