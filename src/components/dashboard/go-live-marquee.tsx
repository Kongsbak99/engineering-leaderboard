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
    <div className="mx-3 flex shrink-0 items-center gap-3 rounded-full border border-border bg-card/60 py-2 pl-2 pr-5">
      {event.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logoUrl}
          alt={event.tenantName}
          className="h-9 w-9 rounded-full bg-white object-contain p-1"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          {initials(event.tenantName)}
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-foreground">
          {event.tenantName}
        </span>
        <span className="text-xs text-muted-foreground">
          {moduleNameFromEvent(event)} · {relativeTime(event.detectedAt)}
        </span>
      </div>
    </div>
  );
}

export function GoLiveMarquee({ events }: { events: GoLiveFeed[] }) {
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-card/30 text-sm text-muted-foreground">
        No go-lives detected yet
      </div>
    );
  }

  const looped = [...events, ...events];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/40 py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max animate-marquee">
        {looped.map((event, idx) => (
          <MarqueeItem key={`${event.id}-${idx}`} event={event} />
        ))}
      </div>
    </div>
  );
}
