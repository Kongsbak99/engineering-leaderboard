import { Activity } from "lucide-react";
import { HealthBanner } from "@/components/dashboard/health-banner";
import { DeliveryLeaderboard } from "@/components/dashboard/delivery-leaderboard";
import { CollabLeaderboard } from "@/components/dashboard/collab-leaderboard";
import { ProjectLeaderboard } from "@/components/dashboard/project-leaderboard";
import { TVAutoRefresh } from "@/components/tv/tv-auto-refresh";
import { TVClock } from "@/components/tv/tv-clock";
import {
  getHealthMetrics,
  getDeliveryLeaders,
  getCollabLeaders,
  getProjectMetrics,
} from "@/lib/data";

export const revalidate = 300;

export const metadata = {
  title: "Engineering Pulse — TV",
};

export default async function TVPage() {
  const [healthMetrics, deliveryLeaders, collabLeaders, projects] =
    await Promise.all([
      getHealthMetrics(),
      getDeliveryLeaders(),
      getCollabLeaders(),
      getProjectMetrics(),
    ]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <TVAutoRefresh />

      <div className="flex flex-col h-screen p-6 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Activity className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Engineering Pulse
              </h1>
              <p className="text-sm text-muted-foreground">
                Live engineering performance &amp; momentum
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-muted-foreground font-medium">
                Live — This Week
              </span>
            </div>
            <TVClock />
          </div>
        </div>

        {/* Health metrics */}
        <div className="shrink-0">
          <HealthBanner metrics={healthMetrics} large />
        </div>

        {/* Leaderboards */}
        <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
          <DeliveryLeaderboard
            engineers={deliveryLeaders}
            maxEntries={8}
            large
          />
          <CollabLeaderboard
            engineers={collabLeaders}
            maxEntries={8}
            large
          />
          <ProjectLeaderboard projects={projects} maxEntries={5} large />
        </div>
      </div>
    </div>
  );
}
