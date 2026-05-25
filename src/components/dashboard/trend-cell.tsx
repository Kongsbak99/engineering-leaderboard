import type { Trend } from "@/lib/mongodb/types";

/** Cap absurd "no-baseline" growth so the cell stays compact. */
const MAX_PCT = 999;

function formatPct(pct: number): string {
  const clamped = Math.max(-MAX_PCT, Math.min(MAX_PCT, Math.round(pct)));
  const sign = clamped > 0 ? "+" : "";
  return `${sign}${clamped}%`;
}

export function TrendCell({ trend }: { trend: Trend }) {
  // Brand-new row: had activity this week but nothing in the previous window.
  if (trend.isNew) {
    return (
      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-emerald-400">
        <span aria-hidden>★</span>
        <span>new</span>
      </span>
    );
  }

  if (trend.pct === null || trend.pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
        <span aria-hidden>—</span>
        <span>0%</span>
      </span>
    );
  }

  const up = trend.pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span>{formatPct(trend.pct)}</span>
    </span>
  );
}
