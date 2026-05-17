import {
  mockHealthMetrics,
  mockDeliveryLeaders,
  mockCollabLeaders,
  mockProjects,
} from "@/lib/mock-data";
import type {
  EngineerWithScores,
  ProjectWithMetrics,
  HealthMetrics,
} from "@/lib/supabase/types";

const USE_MOCK = !process.env.NEXT_PUBLIC_SUPABASE_URL;

async function querySupabase() {
  const { supabase } = await import("@/lib/supabase/client");
  return supabase;
}

export async function getHealthMetrics(): Promise<HealthMetrics> {
  if (USE_MOCK) return mockHealthMetrics;

  const supabase = await querySupabase();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [
    { count: deploys },
    { count: openPrs },
    { data: cycleData },
  ] = await Promise.all([
    supabase
      .from("commits")
      .select("id", { count: "exact", head: true })
      .gte("committed_at", weekStart.toISOString()),
    supabase
      .from("pull_requests")
      .select("id", { count: "exact", head: true })
      .eq("state", "open"),
    supabase
      .from("linear_issues")
      .select("cycle_time_hours")
      .not("cycle_time_hours", "is", null)
      .gte("completed_at", weekStart.toISOString()),
  ]);

  const cycleTimes = (cycleData ?? [])
    .map((i) => i.cycle_time_hours)
    .filter((v): v is number => v != null);

  const avgCycleTimeDays =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / 24
      : 0;

  return {
    deploys_this_week: deploys ?? 0,
    avg_cycle_time_days: Math.round(avgCycleTimeDays * 10) / 10,
    open_prs: openPrs ?? 0,
    change_failure_rate: 3.2, // Placeholder until we track failures
  };
}

export async function getDeliveryLeaders(): Promise<EngineerWithScores[]> {
  if (USE_MOCK) return mockDeliveryLeaders;

  const supabase = await querySupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data: snapshots } = await supabase
    .from("daily_snapshots")
    .select("*, engineers(*)")
    .eq("date", today)
    .order("delivery_score", { ascending: false })
    .limit(15);

  if (!snapshots?.length) return mockDeliveryLeaders;

  return snapshots.map((s) => {
    const eng = s.engineers as Record<string, unknown>;
    return {
      id: eng.id as string,
      github_username: eng.github_username as string,
      linear_id: (eng.linear_id as string) ?? null,
      display_name: eng.display_name as string,
      avatar_url: (eng.avatar_url as string) ?? null,
      team: (eng.team as string) ?? null,
      created_at: eng.created_at as string,
      delivery_score: s.delivery_score,
      collaboration_score: s.collaboration_score,
      prs_merged: s.prs_merged,
      reviews_given: s.reviews_given,
      avg_cycle_time_hours: s.avg_cycle_time_hours,
      commits_count: s.commits_count,
    };
  });
}

export async function getCollabLeaders(): Promise<EngineerWithScores[]> {
  if (USE_MOCK) return mockCollabLeaders;

  const supabase = await querySupabase();
  const today = new Date().toISOString().split("T")[0];

  const { data: snapshots } = await supabase
    .from("daily_snapshots")
    .select("*, engineers(*)")
    .eq("date", today)
    .order("collaboration_score", { ascending: false })
    .limit(15);

  if (!snapshots?.length) return mockCollabLeaders;

  return snapshots.map((s) => {
    const eng = s.engineers as Record<string, unknown>;
    return {
      id: eng.id as string,
      github_username: eng.github_username as string,
      linear_id: (eng.linear_id as string) ?? null,
      display_name: eng.display_name as string,
      avatar_url: (eng.avatar_url as string) ?? null,
      team: (eng.team as string) ?? null,
      created_at: eng.created_at as string,
      delivery_score: s.delivery_score,
      collaboration_score: s.collaboration_score,
      prs_merged: s.prs_merged,
      reviews_given: s.reviews_given,
      avg_cycle_time_hours: s.avg_cycle_time_hours,
      commits_count: s.commits_count,
    };
  });
}

export async function getProjectMetrics(): Promise<ProjectWithMetrics[]> {
  if (USE_MOCK) return mockProjects;

  const { computeProjectScores } = await import("@/lib/scoring/project");
  const supabase = await querySupabase();
  return computeProjectScores(supabase);
}
