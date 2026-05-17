import { Activity } from "lucide-react";
import { HealthBanner } from "@/components/dashboard/health-banner";
import { DeliveryLeaderboard } from "@/components/dashboard/delivery-leaderboard";
import { CollabLeaderboard } from "@/components/dashboard/collab-leaderboard";
import { ProjectLeaderboard } from "@/components/dashboard/project-leaderboard";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import {
  getHealthMetrics,
  getDeliveryLeaders,
  getCollabLeaders,
  getProjectMetrics,
} from "@/lib/data";

export const revalidate = 300; // ISR: revalidate every 5 min

export default async function DashboardPage() {
  const [healthMetrics, deliveryLeaders, collabLeaders, projects] =
    await Promise.all([
      getHealthMetrics(),
      getDeliveryLeaders(),
      getCollabLeaders(),
      getProjectMetrics(),
    ]);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Engineering Pulse
                </h1>
                <p className="text-sm text-muted-foreground">
                  Performance, collaboration &amp; project momentum
                </p>
              </div>
            </div>
            <TimeRangeSelector />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <HealthBanner metrics={healthMetrics} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DeliveryLeaderboard engineers={deliveryLeaders} maxEntries={10} />
          <CollabLeaderboard engineers={collabLeaders} maxEntries={10} />
          <ProjectLeaderboard projects={projects} maxEntries={6} />
        </div>
      </main>
    </div>
  );
}
