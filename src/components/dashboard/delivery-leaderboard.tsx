"use client";

import { Zap } from "lucide-react";
import { LeaderboardCard, type LeaderboardEntry } from "./leaderboard-card";
import type { EngineerWithScores } from "@/lib/supabase/types";

interface DeliveryLeaderboardProps {
  engineers: EngineerWithScores[];
  maxEntries?: number;
  large?: boolean;
}

export function DeliveryLeaderboard({
  engineers,
  maxEntries,
  large,
}: DeliveryLeaderboardProps) {
  const entries: LeaderboardEntry[] = engineers.map((e) => ({
    id: e.id,
    name: e.display_name,
    avatar_url: e.avatar_url,
    score: e.delivery_score,
    subtitle: `${e.prs_merged} PRs · ${e.avg_cycle_time_hours != null ? `${(e.avg_cycle_time_hours / 24).toFixed(1)}d cycle` : "—"}`,
    badge: e.team ?? undefined,
  }));

  return (
    <LeaderboardCard
      title="Delivery Leaders"
      description="Cycle time, ship speed & throughput"
      icon={Zap}
      entries={entries}
      maxEntries={maxEntries}
      scoreLabel="Score"
      accentClass="bg-emerald-500/10 text-emerald-500"
      large={large}
    />
  );
}
