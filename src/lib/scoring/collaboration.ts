import { SCORING_WEIGHTS, SCORE_RANGE } from "@/config/scoring";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CollabRawMetrics {
  engineer_id: string;
  reviews_given: number;
  avg_review_turnaround_hours: number | null;
  cross_team_reviews: number;
  unblocking_comments: number;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

export async function computeCollaborationScores(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { data: engineers } = await supabase
    .from("engineers")
    .select("id, team");

  if (!engineers?.length) return new Map();

  const engineerTeams = new Map(engineers.map((e) => [e.id, e.team]));
  const metrics: CollabRawMetrics[] = [];

  for (const eng of engineers) {
    // Reviews given in period
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, pr_id, submitted_at")
      .eq("reviewer_id", eng.id)
      .gte("submitted_at", startDate)
      .lte("submitted_at", endDate);

    const reviewsGiven = reviews?.length ?? 0;

    // Calculate review turnaround: time from PR creation to review
    let totalTurnaround = 0;
    let turnaroundCount = 0;

    if (reviews?.length) {
      const prIds = [...new Set(reviews.map((r) => r.pr_id))];
      const { data: prs } = await supabase
        .from("pull_requests")
        .select("id, created_at, engineer_id")
        .in("id", prIds);

      if (prs) {
        for (const review of reviews) {
          const pr = prs.find((p) => p.id === review.pr_id);
          if (pr) {
            const turnaround =
              (new Date(review.submitted_at).getTime() -
                new Date(pr.created_at).getTime()) /
              (1000 * 60 * 60);
            if (turnaround > 0) {
              totalTurnaround += turnaround;
              turnaroundCount++;
            }
          }
        }
      }

      // Cross-team reviews
      let crossTeam = 0;
      if (prs) {
        const myTeam = engineerTeams.get(eng.id);
        for (const pr of prs) {
          const prAuthorTeam = engineerTeams.get(pr.engineer_id);
          if (myTeam && prAuthorTeam && myTeam !== prAuthorTeam) {
            crossTeam++;
          }
        }
      }

      metrics.push({
        engineer_id: eng.id,
        reviews_given: reviewsGiven,
        avg_review_turnaround_hours:
          turnaroundCount > 0 ? totalTurnaround / turnaroundCount : null,
        cross_team_reviews: crossTeam,
        unblocking_comments: 0,
      });
    } else {
      metrics.push({
        engineer_id: eng.id,
        reviews_given: 0,
        avg_review_turnaround_hours: null,
        cross_team_reviews: 0,
        unblocking_comments: 0,
      });
    }
  }

  // Normalization ranges
  const revAll = metrics.map((m) => m.reviews_given);
  const revMin = Math.min(...revAll);
  const revMax = Math.max(...revAll, 1);

  const turnarounds = metrics
    .map((m) => m.avg_review_turnaround_hours)
    .filter((v): v is number => v != null);
  const tMin = Math.min(...turnarounds, 0);
  const tMax = Math.max(...turnarounds, 1);

  const ctAll = metrics.map((m) => m.cross_team_reviews);
  const ctMin = Math.min(...ctAll);
  const ctMax = Math.max(...ctAll, 1);

  const w = SCORING_WEIGHTS.collaboration;
  const scores = new Map<string, number>();

  for (const m of metrics) {
    const reviewScore = normalize(m.reviews_given, revMin, revMax);
    const turnaroundScore =
      m.avg_review_turnaround_hours != null
        ? normalizeInverse(m.avg_review_turnaround_hours, tMin, tMax)
        : 50;
    const crossTeamScore = normalize(m.cross_team_reviews, ctMin, ctMax);
    const unblockScore = 50; // Placeholder until we have comment data

    const total =
      reviewScore * w.reviewsGiven +
      turnaroundScore * w.reviewTurnaround +
      crossTeamScore * w.crossTeamReviews +
      unblockScore * w.unblocking;

    scores.set(
      m.engineer_id,
      Math.round(Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max, total)))
    );
  }

  return scores;
}
