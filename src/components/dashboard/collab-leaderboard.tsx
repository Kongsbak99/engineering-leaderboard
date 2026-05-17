"use client";

import { Users } from "lucide-react";
import { LeaderboardCard, type LeaderboardEntry } from "./leaderboard-card";
import type { EngineerWithScores } from "@/lib/supabase/types";

interface CollabLeaderboardProps {
  engineers: EngineerWithScores[];
  maxEntries?: number;
  large?: boolean;
}

export function CollabLeaderboard({
  engineers,
  maxEntries,
  large,
}: CollabLeaderboardProps) {
  const entries: LeaderboardEntry[] = engineers.map((e) => ({
    id: e.id,
    name: e.display_name,
    avatar_url: e.avatar_url,
    score: e.collaboration_score,
    subtitle: `${e.reviews_given} reviews given`,
    badge: e.team ?? undefined,
  }));

  return (
    <LeaderboardCard
      title="Collaboration Leaders"
      description="Reviews, unblocking & cross-team help"
      icon={Users}
      entries={entries}
      maxEntries={maxEntries}
      scoreLabel="Score"
      accentClass="bg-blue-500/10 text-blue-500"
      large={large}
    />
  );
}
