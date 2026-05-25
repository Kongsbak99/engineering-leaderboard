import type { GoLiveFeed } from "@/lib/mongodb/types";
import { FEATURE_FLAG_DISPLAY_NAMES } from "@/config/scoring";

function moduleNameFromEvent(event: GoLiveFeed): string {
  if (event.category === "feature_flag") {
    return FEATURE_FLAG_DISPLAY_NAMES[event.field] ?? event.field;
  }
  if (event.category === "integration") {
    const name = event.field.startsWith("integrations.")
      ? event.field.slice("integrations.".length)
      : event.field;
    return `${name.toUpperCase()} integration`;
  }
  if (event.category === "agent_config") return "New agent published";
  if (event.category === "tenant_created") return "Tenant created";
  if (event.category === "user_growth") return "User growth milestone";
  return event.field;
}

function categoryLabel(event: GoLiveFeed): string {
  switch (event.category) {
    case "feature_flag":
      return "Module live";
    case "integration":
      return "Integration live";
    case "agent_config":
      return "Agent published";
    case "tenant_created":
      return "Tenant live";
    case "user_growth":
      return "Growth";
    default:
      return "Change";
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function MarqueeItem({ event }: { event: GoLiveFeed }) {
  return (
    <div className="mx-4 flex shrink-0 items-center gap-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-card/70 to-card/40 py-6 pl-6 pr-10 shadow-lg shadow-emerald-500/5">
      {event.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logoUrl}
          alt={event.tenantName}
          className="h-24 w-24 rounded-2xl bg-white object-contain p-3"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl font-semibold text-emerald-300">
          {initials(event.tenantName)}
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
          {categoryLabel(event)}
        </span>
        <span className="mt-1 text-3xl font-semibold text-foreground">
          {event.tenantName}
        </span>
        <span className="mt-1.5 text-lg text-muted-foreground">
          {moduleNameFromEvent(event)}
          <span className="text-muted-foreground/60"> · {relativeTime(event.detectedAt)}</span>
        </span>
      </div>
    </div>
  );
}

function MarqueeLabel({ count }: { count?: number }) {
  return (
    <div className="pointer-events-none relative z-20 flex w-[260px] shrink-0 flex-col items-center justify-center gap-2 border-r border-emerald-500/15 bg-gradient-to-r from-background via-background to-background/95 px-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Live feed
      </span>
      <span className="font-[family-name:var(--font-display)] text-center text-3xl font-bold tracking-tight text-foreground">
        Recent
        <br />
        go-lives
      </span>
      {typeof count === "number" && (
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {count} this month
        </span>
      )}
    </div>
  );
}

export function GoLiveMarquee({
  events,
  watchedTenantCount,
}: {
  events: GoLiveFeed[];
  watchedTenantCount?: number;
}) {
  if (events.length === 0) {
    return (
      <div className="relative flex h-full items-stretch overflow-hidden rounded-2xl border border-dashed border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-card/30">
        <MarqueeLabel />
        <div className="flex flex-1 items-center justify-center px-6">
          <span className="text-base text-muted-foreground">
            {watchedTenantCount
              ? `Monitoring ${watchedTenantCount} tenants for new module activations`
              : "Monitoring all tenants for new module activations"}
          </span>
        </div>
      </div>
    );
  }

  const looped = [...events, ...events];

  return (
    <div className="relative flex h-full items-stretch overflow-hidden rounded-2xl border border-emerald-500/20 bg-card/30 shadow-xl shadow-emerald-500/5">
      <MarqueeLabel count={events.length} />
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background/90 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
        <div className="flex h-full w-max items-center animate-marquee">
          {looped.map((event, idx) => (
            <MarqueeItem key={`${event.id}-${idx}`} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}
