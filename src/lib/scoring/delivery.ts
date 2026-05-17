import { SCORING_WEIGHTS, SCORE_RANGE } from "@/config/scoring";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DeliveryRawMetrics {
  engineer_id: string;
  avg_cycle_time_hours: number | null;
  prs_merged: number;
  deploy_count: number;
  revert_count: number;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

export async function computeDeliveryScores(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { data: engineers } = await supabase
    .from("engineers")
    .select("id");

  if (!engineers?.length) return new Map();

  const metrics: DeliveryRawMetrics[] = [];

  for (const eng of engineers) {
    // Average cycle time from Linear issues
    const { data: issues } = await supabase
      .from("linear_issues")
      .select("cycle_time_hours")
      .eq("engineer_id", eng.id)
      .not("cycle_time_hours", "is", null)
      .gte("completed_at", startDate)
      .lte("completed_at", endDate);

    const cycleTimes = (issues ?? [])
      .map((i) => i.cycle_time_hours)
      .filter((v): v is number => v != null);

    const avgCycleTime =
      cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : null;

    // PRs merged
    const { count: prsMerged } = await supabase
      .from("pull_requests")
      .select("id", { count: "exact", head: true })
      .eq("engineer_id", eng.id)
      .eq("state", "merged")
      .gte("merged_at", startDate)
      .lte("merged_at", endDate);

    // Commits as proxy for deploy frequency
    const { count: deployCount } = await supabase
      .from("commits")
      .select("id", { count: "exact", head: true })
      .eq("engineer_id", eng.id)
      .gte("committed_at", startDate)
      .lte("committed_at", endDate);

    metrics.push({
      engineer_id: eng.id,
      avg_cycle_time_hours: avgCycleTime,
      prs_merged: prsMerged ?? 0,
      deploy_count: deployCount ?? 0,
      revert_count: 0,
    });
  }

  // Compute ranges for normalization
  const cycleTimesAll = metrics
    .map((m) => m.avg_cycle_time_hours)
    .filter((v): v is number => v != null);
  const ctMin = Math.min(...cycleTimesAll, 0);
  const ctMax = Math.max(...cycleTimesAll, 1);

  const prsAll = metrics.map((m) => m.prs_merged);
  const prMin = Math.min(...prsAll);
  const prMax = Math.max(...prsAll, 1);

  const deployAll = metrics.map((m) => m.deploy_count);
  const dMin = Math.min(...deployAll);
  const dMax = Math.max(...deployAll, 1);

  const w = SCORING_WEIGHTS.delivery;
  const scores = new Map<string, number>();

  for (const m of metrics) {
    const ctScore =
      m.avg_cycle_time_hours != null
        ? normalizeInverse(m.avg_cycle_time_hours, ctMin, ctMax)
        : 50;

    const prScore = normalize(m.prs_merged, prMin, prMax);
    const deployScore = normalize(m.deploy_count, dMin, dMax);
    const revertScore = 100; // No revert data yet

    const total =
      ctScore * w.cycleTime +
      prScore * w.prsMerged +
      deployScore * w.deployFrequency +
      revertScore * w.revertRate;

    scores.set(
      m.engineer_id,
      Math.round(Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max, total)))
    );
  }

  return scores;
}
