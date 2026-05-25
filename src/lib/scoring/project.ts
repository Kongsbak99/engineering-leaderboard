import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { SCORING_WEIGHTS, SCORE_RANGE } from "@/config/scoring";
import {
  goLiveEventsCol,
  linearIssuesCol,
  projectMappingsCol,
  projectScoresCol,
  projectsCol,
  pullRequestsCol,
  usageMetricsCol,
} from "@/lib/mongodb/collections";
import type {
  ProjectMomentumComponents,
  ProjectScore,
} from "@/lib/mongodb/types";

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

interface ProjectRawMetrics {
  linearProjectId: string;
  projectMongoId: string;
  ticketsCompleted: number;
  ticketsCreated: number;
  blockedCount: number;
  avgCycleTimeHours: number | null;
  estimateCompleted: number;
  estimateAvgRatio: number | null;
  prsMerged: number;
  linesChanged: number;
  goLiveCount: number;
  usageGrowth: number;
}

export async function computeProjectMomentumScores(
  db: Db,
  startDate: Date,
  endDate: Date,
  prevPeriodStart: Date
): Promise<ProjectScore[]> {
  const projects = await projectsCol(db).find().toArray();
  if (!projects.length) return [];

  const mappings = await projectMappingsCol(db).find().toArray();
  const mappingByProject = new Map(
    mappings.map((m) => [m.linearProjectId, m])
  );

  const raw: ProjectRawMetrics[] = [];

  for (const project of projects) {
    const projectMongoId = project._id!.toString();

    const completedIssues = await linearIssuesCol(db)
      .find({
        projectId: projectMongoId,
        completedAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    const ticketsCompleted = completedIssues.length;
    const ticketsCreated = await linearIssuesCol(db).countDocuments({
      projectId: projectMongoId,
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const blockedCount = await linearIssuesCol(db).countDocuments({
      projectId: projectMongoId,
      state: { $in: ["Blocked", "On Hold"] },
    });

    const cycleTimes = completedIssues
      .map((i) => i.cycleTimeHours)
      .filter((v): v is number => v != null);
    const avgCycleTimeHours =
      cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : null;

    const estimateCompleted = completedIssues.reduce(
      (sum, i) => sum + (i.estimate ?? 0),
      0
    );

    const ratios = completedIssues
      .filter((i) => i.estimate && i.cycleTimeHours)
      .map((i) => (i.cycleTimeHours ?? 0) / (i.estimate ?? 1));
    const estimateAvgRatio =
      ratios.length > 0
        ? ratios.reduce((a, b) => a + b, 0) / ratios.length
        : null;

    const linkedIssues = await linearIssuesCol(db)
      .find({ projectId: projectMongoId })
      .project<{ linkedPrIds: string[] }>({ linkedPrIds: 1, _id: 0 })
      .toArray();
    const linkedPrIds = new Set<string>();
    linkedIssues.forEach((i) =>
      (i.linkedPrIds ?? []).forEach((id) => linkedPrIds.add(id))
    );

    let prsMerged = 0;
    let linesChanged = 0;

    if (linkedPrIds.size > 0) {
      const prObjIds = Array.from(linkedPrIds)
        .map((id) => {
          try {
            return new ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter((v): v is ObjectId => v !== null);
      const prs = await pullRequestsCol(db)
        .find({
          _id: { $in: prObjIds },
          mergedAt: { $gte: startDate, $lte: endDate },
        })
        .toArray();
      prsMerged = prs.length;
      linesChanged = prs.reduce(
        (sum, pr) => sum + (pr.additions ?? 0) + (pr.deletions ?? 0),
        0
      );
    }

    const mapping = mappingByProject.get(project.linearProjectId);

    let goLiveCount = 0;
    let usageGrowth = 0;

    if (mapping) {
      goLiveCount = await goLiveEventsCol(db).countDocuments({
        detectedAt: { $gte: startDate, $lte: endDate },
        $or: [
          ...(mapping.featureFlags.length
            ? [{ field: { $in: mapping.featureFlags } }]
            : []),
          ...(mapping.integrations.length
            ? [
                {
                  field: {
                    $in: mapping.integrations.map((i) => `integrations.${i}`),
                  },
                },
              ]
            : []),
        ],
      });

      if (mapping.tenantIds.length > 0) {
        const currentMetrics = await usageMetricsCol(db)
          .find({
            tenantId: { $in: mapping.tenantIds },
            date: {
              $gte: startDate.toISOString().split("T")[0],
              $lte: endDate.toISOString().split("T")[0],
            },
          })
          .toArray();
        const prevMetrics = await usageMetricsCol(db)
          .find({
            tenantId: { $in: mapping.tenantIds },
            date: {
              $gte: prevPeriodStart.toISOString().split("T")[0],
              $lt: startDate.toISOString().split("T")[0],
            },
          })
          .toArray();

        const sum = (arr: { conversations: number; purchaseRequests: number; itemSearches: number; agentRuns: number }[]) =>
          arr.reduce(
            (s, m) =>
              s + m.conversations + m.purchaseRequests + m.itemSearches + m.agentRuns,
            0
          );

        const current = sum(currentMetrics);
        const previous = sum(prevMetrics);
        usageGrowth = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      }
    }

    raw.push({
      linearProjectId: project.linearProjectId,
      projectMongoId,
      ticketsCompleted,
      ticketsCreated,
      blockedCount,
      avgCycleTimeHours,
      estimateCompleted,
      estimateAvgRatio,
      prsMerged,
      linesChanged,
      goLiveCount,
      usageGrowth,
    });
  }

  const completedAll = raw.map((r) => r.ticketsCompleted);
  const estCompletedAll = raw.map((r) => r.estimateCompleted);
  const cycleTimeRatios = raw
    .map((r) => r.estimateAvgRatio)
    .filter((v): v is number => v != null);
  const linesAll = raw.map((r) => r.linesChanged);
  const prsAll = raw.map((r) => r.prsMerged);
  const goLivesAll = raw.map((r) => r.goLiveCount);
  const usageAll = raw.map((r) => r.usageGrowth);

  const w = SCORING_WEIGHTS.momentum;
  const today = endDate.toISOString().split("T")[0];

  const scores: ProjectScore[] = raw.map((r) => {
    const components: ProjectMomentumComponents = {
      ticketVelocity: normalize(
        r.ticketsCompleted,
        Math.min(...completedAll),
        Math.max(...completedAll, 1)
      ),
      ticketThroughput: normalize(
        r.estimateCompleted,
        Math.min(...estCompletedAll),
        Math.max(...estCompletedAll, 1)
      ),
      cycleTimeEfficiency:
        r.estimateAvgRatio != null && cycleTimeRatios.length > 0
          ? normalizeInverse(
              r.estimateAvgRatio,
              Math.min(...cycleTimeRatios),
              Math.max(...cycleTimeRatios, 1)
            )
          : 50,
      codeVolume: normalize(
        r.linesChanged,
        Math.min(...linesAll),
        Math.max(...linesAll, 1)
      ),
      prThroughput: normalize(
        r.prsMerged,
        Math.min(...prsAll),
        Math.max(...prsAll, 1)
      ),
      adoption: normalize(
        r.goLiveCount,
        Math.min(...goLivesAll),
        Math.max(...goLivesAll, 1)
      ),
      userTraction: normalize(
        r.usageGrowth,
        Math.min(...usageAll, 0),
        Math.max(...usageAll, 1)
      ),
    };

    const momentumScore = Math.round(
      Math.max(
        SCORE_RANGE.min,
        Math.min(
          SCORE_RANGE.max,
          components.ticketVelocity * w.ticketVelocity +
            components.ticketThroughput * w.ticketThroughput +
            components.cycleTimeEfficiency * w.cycleTimeEfficiency +
            components.codeVolume * w.codeVolume +
            components.prThroughput * w.prThroughput +
            components.adoption * w.adoption +
            components.userTraction * w.userTraction
        )
      )
    );

    return {
      linearProjectId: r.linearProjectId,
      date: today,
      momentumScore,
      trend: 0,
      components,
      ticketsCompleted: r.ticketsCompleted,
      ticketsCreated: r.ticketsCreated,
      blockedCount: r.blockedCount,
      prsMerged: r.prsMerged,
      linesChanged: r.linesChanged,
      goLiveCount: r.goLiveCount,
      capturedAt: new Date(),
    };
  });

  for (const s of scores) {
    const prev = await projectScoresCol(db)
      .find({ linearProjectId: s.linearProjectId })
      .sort({ date: -1 })
      .limit(2)
      .toArray();
    const lastWeek = prev.find((p) => p.date < s.date);
    if (lastWeek) {
      s.trend = s.momentumScore - lastWeek.momentumScore;
    }
  }

  return scores;
}
