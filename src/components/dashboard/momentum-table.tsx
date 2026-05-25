import type { ProjectMomentumRow } from "@/lib/mongodb/types";
import { TrendCell } from "./trend-cell";

function scoreBar(score: number) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-emerald-500/80"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MomentumTable({ rows }: { rows: ProjectMomentumRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card/60 p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Project Momentum
        </h2>
        <span className="text-[10px] text-muted-foreground">
          rolling 7-day
        </span>
      </header>
      <div className="flex-1 overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="w-8 py-1.5 text-left font-normal">#</th>
              <th className="py-1.5 text-left font-normal">Project</th>
              <th className="w-24 py-1.5 text-right font-normal normal-case">
                Lio Score
              </th>
              <th className="w-20 py-1.5 text-right font-normal">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.linearProjectId}
                className="border-b border-border/30 last:border-0"
              >
                <td className="py-2 text-xs text-muted-foreground">{i + 1}</td>
                <td className="truncate py-2 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {scoreBar(row.momentumScore)}
                    <span className="w-7 text-right tabular-nums font-semibold text-foreground">
                      {row.momentumScore}
                    </span>
                  </div>
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
                  No project scores computed yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
