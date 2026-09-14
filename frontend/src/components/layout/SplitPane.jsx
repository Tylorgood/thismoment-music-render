import { cn } from "@/lib/utils";

export default function SplitPane({ left, right, ratio = 0.5, orientation = "horizontal", className }) {
  const leftPct = ratio * 100;
  return (
    <div
      className={cn(
        "min-w-0 flex-1",
        orientation === "horizontal" ? "flex items-stretch" : "flex flex-col",
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 min-h-0",
          orientation === "horizontal" ? "pr-4" : "pb-4",
          orientation === "horizontal"
            ? { flexBasis: `${leftPct}%` }
            : { flexBasis: `${leftPct}%` }
        )}
        style={{ flexBasis: `${leftPct}%` }}
      >
        {left}
      </div>
      <div
        className={cn(
          "min-w-0 min-h-0",
          orientation === "horizontal" ? "border-l ma-hairline pl-4" : "border-t ma-hairline pt-4",
          orientation === "horizontal" && ratio > 0 && ratio < 1
        )}
      >
        {right}
      </div>
    </div>
  );
}