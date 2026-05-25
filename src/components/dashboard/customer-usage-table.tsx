import type { CustomerUsageRow } from "@/lib/mongodb/types";
import { TrendCell } from "./trend-cell";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtCount(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function CustomerUsageTable({ rows }: { rows: CustomerUsageRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card/60 p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Customer Usage
        </h2>
        <span className="text-[10px] text-muted-foreground">
          rolling 7-day
        </span>
      </header>
      <div className="flex-1 overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="py-1.5 text-left font-normal">Customer</th>
              <th className="w-12 py-1.5 text-right font-normal">DAU</th>
              <th className="w-12 py-1.5 text-right font-normal normal-case">PRs</th>
              <th className="w-16 py-1.5 text-right font-normal">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.tenantId}
                className="border-b border-border/30 last:border-0"
              >
                <td className="py-2 pr-1">
                  <div className="flex items-center gap-2">
                    {row.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.logoUrl}
                        alt={row.displayName}
                        className="h-6 w-6 shrink-0 rounded-full bg-white object-contain p-0.5"
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {initials(row.displayName)}
                      </div>
                    )}
                    <span className="truncate font-medium text-foreground">
                      {row.displayName}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums font-semibold text-foreground">
                  {row.activeUsers}
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {fmtCount(row.purchaseRequests)}
                </td>
                <td className="py-2 text-right">
                  <TrendCell trend={row.trend} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No usage data this week
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
