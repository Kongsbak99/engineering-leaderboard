import { SCORING_WEIGHTS, SCORE_RANGE } from "@/config/scoring";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectWithMetrics } from "@/lib/supabase/types";

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

export async function computeProjectScores(
  supabase: SupabaseClient
): Promise<ProjectWithMetrics[]> {
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "active");

  if (!projects?.length) return [];

  const projectMetrics: ProjectWithMetrics[] = [];

  for (const project of projects) {
    const { count: totalTickets } = await supabase
      .from("linear_issues")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id);

    const { count: completedTickets } = await supabase
      .from("linear_issues")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("state", "Done");

    const { data: completedIssues } = await supabase
      .from("linear_issues")
      .select("cycle_time_hours")
      .eq("project_id", project.id)
      .not("cycle_time_hours", "is", null);

    const cycleTimes = (completedIssues ?? [])
      .map((i) => i.cycle_time_hours)
      .filter((v): v is number => v != null);

    const avgCycleTime =
      cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : null;

    const { count: blockedCount } = await supabase
      .from("linear_issues")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .in("state", ["Blocked", "On Hold"]);

    const total = totalTickets ?? 0;
    const completed = completedTickets ?? 0;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    projectMetrics.push({
      ...project,
      ticket_count: total,
      completed_count: completed,
      avg_cycle_time_hours: avgCycleTime,
      velocity_score: 0,
      blocked_count: blockedCount ?? 0,
      completion_pct: completionPct,
    });
  }

  // Compute velocity scores using normalization across projects
  const velocities = projectMetrics.map((p) => p.completed_count);
  const vMin = Math.min(...velocities);
  const vMax = Math.max(...velocities, 1);

  const cycleTimes = projectMetrics
    .map((p) => p.avg_cycle_time_hours)
    .filter((v): v is number => v != null);
  const ctMin = Math.min(...cycleTimes, 0);
  const ctMax = Math.max(...cycleTimes, 1);

  const blocked = projectMetrics.map((p) => p.blocked_count);
  const bMin = Math.min(...blocked);
  const bMax = Math.max(...blocked, 1);

  const w = SCORING_WEIGHTS.project;

  for (const pm of projectMetrics) {
    const velocityScore = normalize(pm.completed_count, vMin, vMax);
    const ctScore =
      pm.avg_cycle_time_hours != null
        ? normalizeInverse(pm.avg_cycle_time_hours, ctMin, ctMax)
        : 50;
    const burnScore = normalize(pm.completion_pct, 0, 100);
    const blockedScore = normalizeInverse(pm.blocked_count, bMin, bMax);
    const completionScore = normalize(pm.completion_pct, 0, 100);

    const total =
      velocityScore * w.ticketVelocity +
      ctScore * w.cycleTime +
      burnScore * w.burnDown +
      blockedScore * w.blockedCount +
      completionScore * w.completionPct;

    pm.velocity_score = Math.round(
      Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max, total))
    );
  }

  return projectMetrics.sort((a, b) => b.velocity_score - a.velocity_score);
}
