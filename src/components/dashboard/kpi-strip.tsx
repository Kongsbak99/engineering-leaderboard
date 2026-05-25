import type { KpiWithDelta } from "@/lib/mongodb/types";

function fmt(value: number, unit: string): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k${unit}`;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
}

function deltaColor(kpi: KpiWithDelta): string {
  if (kpi.direction === "flat") return "text-muted-foreground";
  if (kpi.direction === "up") return "text-emerald-400";
  return "text-rose-400";
}

function Arrow({ direction }: { direction: KpiWithDelta["direction"] }) {
  if (direction === "flat") {
    return <span className="text-base leading-none">—</span>;
  }
  if (direction === "up") {
    return (
      <svg
        viewBox="0 0 12 12"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden
      >
        <path d="M6 2 L11 8 L1 8 Z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3.5 w-3.5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 10 L1 4 L11 4 Z" />
    </svg>
  );
}

export function KpiStrip({ kpis }: { kpis: KpiWithDelta[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {kpi.label}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-4xl font-semibold tabular-nums text-foreground">
              {fmt(kpi.value, kpi.unit)}
            </div>
          </div>
          <div
            className={`mt-2 flex items-center gap-1.5 text-sm font-medium tabular-nums ${deltaColor(
              kpi
            )}`}
          >
            <Arrow direction={kpi.direction} />
            <span>
              {kpi.delta > 0 ? "+" : ""}
              {fmt(kpi.delta, kpi.unit)}
            </span>
            <span className="text-muted-foreground text-xs">
              ({kpi.deltaPct > 0 ? "+" : ""}
              {kpi.deltaPct.toFixed(0)}%)
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
              vs prev 7d
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
