import Image from "next/image";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { GoLiveMarquee } from "@/components/dashboard/go-live-marquee";
import { MomentumTable } from "@/components/dashboard/momentum-table";
import { CustomerUsageTable } from "@/components/dashboard/customer-usage-table";
import { AgentUsageTable } from "@/components/dashboard/agent-usage-table";
import { ECGPulse } from "@/components/dashboard/ecg-pulse";
import {
  getKpisWithDelta,
  getRecentGoLives,
  getProjectMomentum,
  getCustomerUsage,
  getAgentUsage,
  getWatchedTenantCount,
} from "@/lib/data";

// Always render server-side on every request. The dashboard is internal,
// low-traffic (one TV + a few laptops), so we'd rather see fresh numbers
// than save a few Mongo round-trips. The KPI/trend deltas are 7-day
// rolling windows so they don't whip around between requests anyway.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [
    kpis,
    goLives,
    momentum,
    customers,
    standardAgents,
    aopAgents,
    watchedTenantCount,
  ] = await Promise.all([
    getKpisWithDelta(),
    getRecentGoLives(30),
    getProjectMomentum(15),
    getCustomerUsage(15),
    getAgentUsage("standardized", 15, 7),
    getAgentUsage("aop", 15, 7),
    getWatchedTenantCount(),
  ]);

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-background p-5">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <Image
            src="/lio-logo.png"
            alt="Lio"
            width={56}
            height={56}
            priority
            className="h-11 w-11 object-contain"
          />
          <h1 className="flex items-end gap-0 font-[family-name:var(--font-display)] text-4xl font-bold leading-none tracking-tight text-foreground">
            <span>
              Lio <span className="pulse-word">Pulse</span>
            </span>
            {/* `-mb-1` parks the ECG roughly halfway between the text
                baseline and the descender — i.e. the resting line of the
                waveform sits just under the middle of the "e". */}
            <ECGPulse className="-mb-1" />
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
          <span className="tabular-nums">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </header>

      <section>
        <KpiStrip kpis={kpis} />
      </section>

      <section className="h-[320px] shrink-0">
        <GoLiveMarquee
          events={goLives}
          watchedTenantCount={watchedTenantCount}
        />
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-4 gap-3">
        <MomentumTable rows={momentum} />
        <CustomerUsageTable rows={customers} />
        <AgentUsageTable
          rows={standardAgents}
          title="AGENTS"
          emptyState="No agent runs this week"
        />
        <AgentUsageTable
          rows={aopAgents}
          title="AOPs"
          emptyState="No AOP runs this week"
        />
      </section>
    </main>
  );
}
