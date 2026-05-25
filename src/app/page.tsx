import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { GoLiveMarquee } from "@/components/dashboard/go-live-marquee";
import { MomentumTable } from "@/components/dashboard/momentum-table";
import { CustomerUsageTable } from "@/components/dashboard/customer-usage-table";
import { AgentUsageTable } from "@/components/dashboard/agent-usage-table";
import {
  getKpisWithDelta,
  getRecentGoLives,
  getProjectMomentum,
  getCustomerUsage,
  getAgentUsage,
} from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function HomePage() {
  const [kpis, goLives, momentum, customers, agents] = await Promise.all([
    getKpisWithDelta(),
    getRecentGoLives(30),
    getProjectMomentum(12),
    getCustomerUsage(12),
    getAgentUsage(15),
  ]);

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-background p-5">
      <header className="flex items-baseline justify-between px-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            askLio · Internal Pulse
          </h1>
          <p className="text-xs text-muted-foreground">
            Engineering · Go-lives · Project momentum
          </p>
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

      <section>
        <GoLiveMarquee events={goLives} />
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-3 gap-3">
        <MomentumTable rows={momentum} />
        <CustomerUsageTable rows={customers} />
        <AgentUsageTable rows={agents} />
      </section>
    </main>
  );
}
