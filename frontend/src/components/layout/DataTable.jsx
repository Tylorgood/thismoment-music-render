import { cn } from "@/lib/utils";

export default function DataTable({ columns, rows, rowKey = (row, index) => index, emptyText = "No rows." }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b ma-hairline">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ma-faint"
                style={
                  column.width
                    ? { width: column.width }
                    : column.align === "right"
                      ? { textAlign: "right" }
                      : undefined
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm ma-muted">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className="border-b ma-hairline last:border-b-0 hover:bg-white/[0.03]">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-3 py-2.5 align-middle text-sm text-slate-200")}
                    style={column.align === "right" ? { textAlign: "right" } : undefined}
                  >
                    {column.render ? column.render(row, index) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}