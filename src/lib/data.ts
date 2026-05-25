import type {
  KpiWithDelta,
  GoLiveFeed,
  ProjectMomentumRow,
  CustomerUsageRow,
  AgentUsageRow,
  KpiDirection,
} from "@/lib/mongodb/types";

const USE_MOCK = !process.env.MONGODB_URI;

export function isUsingMock(): boolean {
  return USE_MOCK;
}

async function db() {
  const { getDashboardDb } = await import("@/lib/mongodb/client");
  return getDashboardDb();
}

const DAY_MS = 24 * 60 * 60 * 1000;

function windowsForRolling7d() {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(currentEnd.getTime() - 7 * DAY_MS);
  const previousEnd = currentStart;
  const previousStart = new Date(previousEnd.getTime() - 7 * DAY_MS);
  return { currentStart, currentEnd, previousStart, previousEnd };
}

function dateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function direction(
  delta: number,
  good: "up" | "down"
): KpiDirection {
  if (delta === 0) return "flat";
  if (good === "up") return delta > 0 ? "up" : "down";
  return delta < 0 ? "up" : "down";
}

function buildKpi(
  key: KpiWithDelta["key"],
  label: string,
  unit: string,
  value: number,
  previousValue: number,
  good: "up" | "down"
): KpiWithDelta {
  const delta = value - previousValue;
  const deltaPct =
    previousValue === 0
      ? value === 0
        ? 0
        : 100
      : (delta / Math.abs(previousValue)) * 100;
  return {
    key,
    label,
    unit,
    value: Math.round(value * 10) / 10,
    previousValue: Math.round(previousValue * 10) / 10,
    delta: Math.round(delta * 10) / 10,
    deltaPct: Math.round(deltaPct * 10) / 10,
    direction: direction(delta, good),
    goodDirection: good,
  };
}

const MOCK_KPIS: KpiWithDelta[] = [
  buildKpi("cycleTime", "Avg Cycle Time", "d", 4.2, 5.0, "down"),
  buildKpi("prsMerged", "PRs Merged", "", 37, 25, "up"),
  buildKpi("activeUsers", "Active Users (avg/day)", "", 1247, 1158, "up"),
  buildKpi("goLives", "New Go-Lives", "", 7, 5, "up"),
];

const MOCK_GO_LIVES: GoLiveFeed[] = [
  {
    id: "mock-1",
    tenantId: "covestro",
    tenantName: "Covestro",
    logoUrl: null,
    category: "feature_flag",
    field: "sourcing_agent",
    description: "Sourcing Agent activated for Covestro",
    detectedAt: new Date(),
  },
  {
    id: "mock-2",
    tenantId: "schaeffler",
    tenantName: "Schaeffler",
    logoUrl: null,
    category: "feature_flag",
    field: "order_agent",
    description: "Order Agent activated for Schaeffler",
    detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: "mock-3",
    tenantId: "webasto",
    tenantName: "Webasto",
    logoUrl: null,
    category: "integration",
    field: "integrations.sap",
    description: "SAP integration enabled for Webasto",
    detectedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
];

export async function getKpisWithDelta(): Promise<KpiWithDelta[]> {
  if (USE_MOCK) return MOCK_KPIS;

  const dashboard = await db();
  const { linearIssuesCol, pullRequestsCol, usageMetricsCol, goLiveEventsCol } =
    await import("@/lib/mongodb/collections");

  const { currentStart, currentEnd, previousStart, previousEnd } =
    windowsForRolling7d();

  const [
    cycleCurrent,
    cyclePrevious,
    prsCurrent,
    prsPrevious,
    usageCurrent,
    usagePrevious,
    goLivesCurrent,
    goLivesPrevious,
  ] = await Promise.all([
    linearIssuesCol(dashboard)
      .aggregate<{ avg: number; count: number }>([
        {
          $match: {
            completedAt: { $gte: currentStart, $lt: currentEnd },
            cycleTimeHours: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avg: { $avg: "$cycleTimeHours" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    linearIssuesCol(dashboard)
      .aggregate<{ avg: number; count: number }>([
        {
          $match: {
            completedAt: { $gte: previousStart, $lt: previousEnd },
            cycleTimeHours: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avg: { $avg: "$cycleTimeHours" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    pullRequestsCol(dashboard).countDocuments({
      mergedAt: { $gte: currentStart, $lt: currentEnd },
    }),
    pullRequestsCol(dashboard).countDocuments({
      mergedAt: { $gte: previousStart, $lt: previousEnd },
    }),
    usageMetricsCol(dashboard)
      .aggregate<{ _id: string; totalUsers: number }>([
        {
          $match: {
            date: {
              $gte: dateKey(currentStart),
              $lt: dateKey(currentEnd),
            },
          },
        },
        { $group: { _id: "$date", totalUsers: { $sum: "$activeUsers" } } },
      ])
      .toArray(),
    usageMetricsCol(dashboard)
      .aggregate<{ _id: string; totalUsers: number }>([
        {
          $match: {
            date: {
              $gte: dateKey(previousStart),
              $lt: dateKey(previousEnd),
            },
          },
        },
        { $group: { _id: "$date", totalUsers: { $sum: "$activeUsers" } } },
      ])
      .toArray(),
    goLiveEventsCol(dashboard).countDocuments({
      detectedAt: { $gte: currentStart, $lt: currentEnd },
    }),
    goLiveEventsCol(dashboard).countDocuments({
      detectedAt: { $gte: previousStart, $lt: previousEnd },
    }),
  ]);

  const avgUsersCurrent =
    usageCurrent.length > 0
      ? usageCurrent.reduce((s, d) => s + d.totalUsers, 0) / usageCurrent.length
      : 0;
  const avgUsersPrevious =
    usagePrevious.length > 0
      ? usagePrevious.reduce((s, d) => s + d.totalUsers, 0) /
        usagePrevious.length
      : 0;

  const cycleCurrentDays = (cycleCurrent[0]?.avg ?? 0) / 24;
  const cyclePreviousDays = (cyclePrevious[0]?.avg ?? 0) / 24;

  return [
    buildKpi(
      "cycleTime",
      "Avg Cycle Time",
      "d",
      cycleCurrentDays,
      cyclePreviousDays,
      "down"
    ),
    buildKpi("prsMerged", "PRs Merged", "", prsCurrent, prsPrevious, "up"),
    buildKpi(
      "activeUsers",
      "Active Users (avg/day)",
      "",
      avgUsersCurrent,
      avgUsersPrevious,
      "up"
    ),
    buildKpi(
      "goLives",
      "New Go-Lives",
      "",
      goLivesCurrent,
      goLivesPrevious,
      "up"
    ),
  ];
}

export async function getRecentGoLives(limit = 30): Promise<GoLiveFeed[]> {
  if (USE_MOCK) return MOCK_GO_LIVES.slice(0, limit);

  const dashboard = await db();
  const { goLiveEventsCol, tenantsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const events = await goLiveEventsCol(dashboard)
    .find()
    .sort({ detectedAt: -1 })
    .limit(limit)
    .toArray();

  const tenantIds = Array.from(new Set(events.map((e) => e.tenantId)));
  const tenants = await tenantsCol(dashboard)
    .find({ tenantId: { $in: tenantIds } })
    .toArray();
  const tenantMap = new Map(tenants.map((t) => [t.tenantId, t]));

  return events.map((e) => {
    const t = tenantMap.get(e.tenantId);
    return {
      id: e._id!.toString(),
      tenantId: e.tenantId,
      tenantName: t?.displayName ?? e.tenantName,
      logoUrl: t?.logoUrl ?? null,
      category: e.category,
      field: e.field,
      description: e.description,
      detectedAt: e.detectedAt,
    };
  });
}

export async function getProjectMomentum(
  limit = 12
): Promise<ProjectMomentumRow[]> {
  if (USE_MOCK) {
    return [
      {
        linearProjectId: "p-1",
        name: "Sourcing Agent v2",
        momentumScore: 92,
        trend: 4,
        ticketsCompleted: 18,
        prsMerged: 24,
        goLiveCount: 3,
      },
      {
        linearProjectId: "p-2",
        name: "Goods Receipt Agent",
        momentumScore: 88,
        trend: 2,
        ticketsCompleted: 14,
        prsMerged: 19,
        goLiveCount: 2,
      },
      {
        linearProjectId: "p-3",
        name: "Order Agent",
        momentumScore: 85,
        trend: 0,
        ticketsCompleted: 11,
        prsMerged: 16,
        goLiveCount: 1,
      },
    ].slice(0, limit);
  }

  const dashboard = await db();
  const { projectScoresCol, projectsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const latest = await projectScoresCol(dashboard)
    .find()
    .sort({ date: -1 })
    .limit(1)
    .toArray();
  if (!latest.length) return [];

  const date = latest[0].date;
  const scores = await projectScoresCol(dashboard)
    .find({ date })
    .sort({ momentumScore: -1 })
    .limit(limit)
    .toArray();

  const ids = scores.map((s) => s.linearProjectId);
  const projects = await projectsCol(dashboard)
    .find({ linearProjectId: { $in: ids } })
    .toArray();
  const projectMap = new Map(projects.map((p) => [p.linearProjectId, p]));

  return scores.map((s) => ({
    linearProjectId: s.linearProjectId,
    name: projectMap.get(s.linearProjectId)?.name ?? "Unknown",
    momentumScore: s.momentumScore,
    trend: s.trend,
    ticketsCompleted: s.ticketsCompleted,
    prsMerged: s.prsMerged,
    goLiveCount: s.goLiveCount,
  }));
}

export async function getCustomerUsage(limit = 12): Promise<CustomerUsageRow[]> {
  if (USE_MOCK) {
    return [
      {
        tenantId: "covestro",
        displayName: "Covestro",
        logoUrl: null,
        activeUsers: 142,
        totalSpend: 1_245_000,
        conversations: 982,
        agentRuns: 318,
      },
      {
        tenantId: "schaeffler",
        displayName: "Schaeffler",
        logoUrl: null,
        activeUsers: 98,
        totalSpend: 720_000,
        conversations: 654,
        agentRuns: 211,
      },
      {
        tenantId: "webasto",
        displayName: "Webasto",
        logoUrl: null,
        activeUsers: 76,
        totalSpend: 540_000,
        conversations: 421,
        agentRuns: 144,
      },
    ].slice(0, limit);
  }

  const dashboard = await db();
  const { usageMetricsCol, tenantsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const { currentStart, currentEnd } = windowsForRolling7d();
  const startKey = dateKey(currentStart);
  const endKey = dateKey(currentEnd);

  const agg = await usageMetricsCol(dashboard)
    .aggregate<{
      _id: string;
      totalSpend: number;
      conversations: number;
      agentRuns: number;
      avgActiveUsers: number;
    }>([
      {
        $match: {
          date: { $gte: startKey, $lt: endKey },
        },
      },
      {
        $group: {
          _id: "$tenantId",
          totalSpend: { $sum: "$totalSpend" },
          conversations: { $sum: "$conversations" },
          agentRuns: { $sum: "$agentRuns" },
          avgActiveUsers: { $avg: "$activeUsers" },
        },
      },
      { $sort: { agentRuns: -1, conversations: -1 } },
      { $limit: limit },
    ])
    .toArray();

  if (!agg.length) return [];

  const tenantIds = agg.map((a) => a._id);
  const tenants = await tenantsCol(dashboard)
    .find({ tenantId: { $in: tenantIds } })
    .toArray();
  const tenantMap = new Map(tenants.map((t) => [t.tenantId, t]));

  return agg.map((a) => {
    const t = tenantMap.get(a._id);
    return {
      tenantId: a._id,
      displayName: t?.displayName ?? a._id,
      logoUrl: t?.logoUrl ?? null,
      activeUsers: Math.round(a.avgActiveUsers ?? 0),
      totalSpend: Math.round(a.totalSpend ?? 0),
      conversations: a.conversations,
      agentRuns: a.agentRuns,
    };
  });
}

export async function getAgentUsage(limit = 15): Promise<AgentUsageRow[]> {
  if (USE_MOCK) {
    return [
      {
        agentName: "Sourcing Agent v2",
        tenantId: "covestro",
        displayName: "Covestro",
        logoUrl: null,
        runs: 1021,
      },
      {
        agentName: "Goods Receipt Agent",
        tenantId: "schaeffler",
        displayName: "Schaeffler",
        logoUrl: null,
        runs: 842,
      },
      {
        agentName: "Order Agent",
        tenantId: "webasto",
        displayName: "Webasto",
        logoUrl: null,
        runs: 612,
      },
    ].slice(0, limit);
  }

  const dashboard = await db();
  const { usageMetricsCol, tenantsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const { currentStart, currentEnd } = windowsForRolling7d();
  const startKey = dateKey(currentStart);
  const endKey = dateKey(currentEnd);

  const docs = await usageMetricsCol(dashboard)
    .find({
      date: { $gte: startKey, $lt: endKey },
      agentRunsByName: { $exists: true },
    })
    .project<{ tenantId: string; agentRunsByName: Record<string, number> }>({
      tenantId: 1,
      agentRunsByName: 1,
      _id: 0,
    })
    .toArray();

  const counts = new Map<string, number>();
  for (const doc of docs) {
    const byName = doc.agentRunsByName ?? {};
    for (const [agentName, runs] of Object.entries(byName)) {
      if (!agentName) continue;
      const key = `${doc.tenantId}::${agentName}`;
      counts.set(key, (counts.get(key) ?? 0) + (runs as number));
    }
  }

  const rows = Array.from(counts.entries())
    .map(([key, runs]) => {
      const [tenantId, agentName] = key.split("::");
      return { tenantId, agentName, runs };
    })
    .filter((r) => r.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, limit);

  if (!rows.length) return [];

  const tenantIds = Array.from(new Set(rows.map((r) => r.tenantId)));
  const tenants = await tenantsCol(dashboard)
    .find({ tenantId: { $in: tenantIds } })
    .toArray();
  const tenantMap = new Map(tenants.map((t) => [t.tenantId, t]));

  return rows.map((r) => {
    const t = tenantMap.get(r.tenantId);
    return {
      agentName: r.agentName,
      tenantId: r.tenantId,
      displayName: t?.displayName ?? r.tenantId,
      logoUrl: t?.logoUrl ?? null,
      runs: r.runs,
    };
  });
}
