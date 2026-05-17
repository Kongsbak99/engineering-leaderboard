"use client";

import { Rocket, Timer, GitPullRequest, ShieldCheck } from "lucide-react";
import { MetricCard } from "./metric-card";
import type { HealthMetrics } from "@/lib/supabase/types";

interface HealthBannerProps {
  metrics: HealthMetrics;
  large?: boolean;
}

export function HealthBanner({ metrics, large }: HealthBannerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <MetricCard
        title="Deploys This Week"
        value={metrics.deploys_this_week}
        icon={Rocket}
        trend={{ value: 12, label: "vs last week" }}
        large={large}
      />
      <MetricCard
        title="Avg Cycle Time"
        value={`${metrics.avg_cycle_time_days}d`}
        subtitle="assignment → done"
        icon={Timer}
        trend={{ value: -8, label: "vs last week" }}
        large={large}
      />
      <MetricCard
        title="Open PRs"
        value={metrics.open_prs}
        icon={GitPullRequest}
        large={large}
      />
      <MetricCard
        title="Change Failure Rate"
        value={`${metrics.change_failure_rate}%`}
        subtitle="deploys causing issues"
        icon={ShieldCheck}
        trend={{ value: -2.1, label: "vs last week" }}
        large={large}
      />
    </div>
  );
}
