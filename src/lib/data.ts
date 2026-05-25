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
  return windowsForRollingNd(7);
}

function windowsForRollingNd(days: number) {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(currentEnd.getTime() - days * DAY_MS);
  const previousEnd = currentStart;
  const previousStart = new Date(previousEnd.getTime() - days * DAY_MS);
  return { currentStart, currentEnd, previousStart, previousEnd };
}

/**
 * Compute a trend (% change current vs previous) with sane handling of the
 * "no history" case. Returns `isNew: true` when current > 0 but previous was 0,
 * so the UI can render "new" instead of an infinity.
 */
function computeTrend(current: number, previous: number): {
  pct: number | null;
  isNew: boolean;
} {
  if (previous === 0 && current === 0) return { pct: 0, isNew: false };
  if (previous === 0) return { pct: null, isNew: true };
  return {
    pct: ((current - previous) / Math.abs(previous)) * 100,
    isNew: false,
  };
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
  buildKpi("activeUsers", "Active Users (avg/day)", "", 1247, 1158, "up"),
  buildKpi("goLives", "New Go-Lives", "", 7, 5, "up"),
  buildKpi("purchaseRequests", "Purchase Requests", "", 2314, 1980, "up"),
  buildKpi("agentRuns", "Agent Runs", "", 4821, 3950, "up"),
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
  const { usageMetricsCol, goLiveEventsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const { currentStart, currentEnd, previousStart, previousEnd } =
    windowsForRolling7d();
  const startKey = dateKey(currentStart);
  const endKey = dateKey(currentEnd);
  const prevStartKey = dateKey(previousStart);
  const prevEndKey = dateKey(previousEnd);

  type UsageAgg = {
    _id: null;
    totalUsers: number;
    days: number;
    purchaseRequests: number;
    agentRuns: number;
  };

  const aggForWindow = (gte: string, lt: string) =>
    usageMetricsCol(dashboard)
      .aggregate<UsageAgg>([
        { $match: { date: { $gte: gte, $lt: lt } } },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: "$activeUsers" },
            days: { $addToSet: "$date" },
            purchaseRequests: { $sum: "$purchaseRequests" },
            agentRuns: { $sum: "$agentRuns" },
          },
        },
        {
          $project: {
            _id: 1,
            totalUsers: 1,
            days: { $size: "$days" },
            purchaseRequests: 1,
            agentRuns: 1,
          },
        },
      ])
      .toArray();

  const [currentAgg, previousAgg, goLivesCurrent, goLivesPrevious] =
    await Promise.all([
      aggForWindow(startKey, endKey),
      aggForWindow(prevStartKey, prevEndKey),
      goLiveEventsCol(dashboard).countDocuments({
        detectedAt: { $gte: currentStart, $lt: currentEnd },
      }),
      goLiveEventsCol(dashboard).countDocuments({
        detectedAt: { $gte: previousStart, $lt: previousEnd },
      }),
    ]);

  const cur = currentAgg[0];
  const prev = previousAgg[0];

  const avgUsersCurrent =
    cur && cur.days > 0 ? cur.totalUsers / cur.days : 0;
  const avgUsersPrevious =
    prev && prev.days > 0 ? prev.totalUsers / prev.days : 0;

  return [
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
    buildKpi(
      "purchaseRequests",
      "Purchase Requests",
      "",
      cur?.purchaseRequests ?? 0,
      prev?.purchaseRequests ?? 0,
      "up"
    ),
    buildKpi(
      "agentRuns",
      "Agent Runs",
      "",
      cur?.agentRuns ?? 0,
      prev?.agentRuns ?? 0,
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
        trend: { pct: 8, isNew: false },
      },
      {
        linearProjectId: "p-2",
        name: "Goods Receipt Agent",
        momentumScore: 88,
        trend: { pct: 3, isNew: false },
      },
      {
        linearProjectId: "p-3",
        name: "Order Agent",
        momentumScore: 85,
        trend: { pct: -5, isNew: false },
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

  // Pull each project's prior score (closest date strictly earlier than the
  // current rollup) so we can express trend as a percent change of the Lio
  // Score itself, not the raw delta.
  const ids = scores.map((s) => s.linearProjectId);
  const priorScores = await projectScoresCol(dashboard)
    .find({ linearProjectId: { $in: ids }, date: { $lt: date } })
    .sort({ date: -1 })
    .toArray();
  const priorByProject = new Map<string, number>();
  for (const p of priorScores) {
    if (!priorByProject.has(p.linearProjectId)) {
      priorByProject.set(p.linearProjectId, p.momentumScore);
    }
  }

  const projects = await projectsCol(dashboard)
    .find({ linearProjectId: { $in: ids } })
    .toArray();
  const projectMap = new Map(projects.map((p) => [p.linearProjectId, p]));

  return scores.map((s) => {
    const previous = priorByProject.get(s.linearProjectId);
    const trend =
      previous === undefined
        ? { pct: 0, isNew: false }
        : computeTrend(s.momentumScore, previous);
    return {
      linearProjectId: s.linearProjectId,
      name: projectMap.get(s.linearProjectId)?.name ?? "Unknown",
      momentumScore: s.momentumScore,
      trend,
    };
  });
}

export async function getCustomerUsage(limit = 12): Promise<CustomerUsageRow[]> {
  if (USE_MOCK) {
    return [
      {
        tenantId: "covestro",
        displayName: "Covestro",
        logoUrl: null,
        activeUsers: 142,
        purchaseRequests: 318,
        totalSpend: 1_245_000,
        conversations: 982,
        trend: { pct: 18, isNew: false },
      },
      {
        tenantId: "schaeffler",
        displayName: "Schaeffler",
        logoUrl: null,
        activeUsers: 98,
        purchaseRequests: 211,
        totalSpend: 720_000,
        conversations: 654,
        trend: { pct: -7, isNew: false },
      },
      {
        tenantId: "webasto",
        displayName: "Webasto",
        logoUrl: null,
        activeUsers: 76,
        purchaseRequests: 144,
        totalSpend: 540_000,
        conversations: 421,
        trend: { pct: 4, isNew: false },
      },
    ].slice(0, limit);
  }

  const dashboard = await db();
  const { usageMetricsCol, tenantsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const { currentStart, currentEnd, previousStart, previousEnd } =
    windowsForRolling7d();
  const startKey = dateKey(currentStart);
  const endKey = dateKey(currentEnd);
  const prevStartKey = dateKey(previousStart);
  const prevEndKey = dateKey(previousEnd);

  const aggFor = async (gte: string, lt: string) =>
    usageMetricsCol(dashboard)
      .aggregate<{
        _id: string;
        totalSpend: number;
        conversations: number;
        purchaseRequests: number;
        avgActiveUsers: number;
      }>([
        { $match: { date: { $gte: gte, $lt: lt } } },
        {
          $group: {
            _id: "$tenantId",
            totalSpend: { $sum: "$totalSpend" },
            conversations: { $sum: "$conversations" },
            purchaseRequests: { $sum: "$purchaseRequests" },
            avgActiveUsers: { $avg: "$activeUsers" },
          },
        },
      ])
      .toArray();

  const [agg, prevAgg] = await Promise.all([
    aggFor(startKey, endKey),
    aggFor(prevStartKey, prevEndKey),
  ]);

  if (!agg.length) return [];

  const prevMap = new Map<string, number>();
  for (const p of prevAgg) {
    const dau = Math.round(p.avgActiveUsers ?? 0);
    const prs = p.purchaseRequests ?? 0;
    prevMap.set(p._id, Math.sqrt(dau * prs));
  }

  // Rank by the geometric mean of DAU and PRs/week. This gives us a single
  // "engagement" signal that requires *both* dimensions: 100 daily users who
  // don't create any requests score the same as 0 users (~0), while a tenant
  // with 30 users creating 1k PRs scores well. Spend is intentionally ignored
  // - it tracks contract size, not how happy users are.
  const ranked = agg
    .map((a) => {
      const dau = Math.round(a.avgActiveUsers ?? 0);
      const prs = a.purchaseRequests ?? 0;
      const engagement = Math.sqrt(dau * prs);
      return {
        tenantId: a._id,
        dau,
        prs,
        conversations: a.conversations ?? 0,
        totalSpend: Math.round(a.totalSpend ?? 0),
        engagement,
        trend: computeTrend(engagement, prevMap.get(a._id) ?? 0),
      };
    })
    .sort((a, b) => {
      if (b.engagement !== a.engagement) return b.engagement - a.engagement;
      if (b.dau !== a.dau) return b.dau - a.dau;
      return b.prs - a.prs;
    })
    .slice(0, limit);

  const tenantIds = ranked.map((a) => a.tenantId);
  const tenants = await tenantsCol(dashboard)
    .find({ tenantId: { $in: tenantIds } })
    .toArray();
  const tenantMap = new Map(tenants.map((t) => [t.tenantId, t]));

  return ranked.map((a) => {
    const t = tenantMap.get(a.tenantId);
    return {
      tenantId: a.tenantId,
      displayName: t?.displayName ?? a.tenantId,
      logoUrl: t?.logoUrl ?? null,
      activeUsers: a.dau,
      purchaseRequests: a.prs,
      totalSpend: a.totalSpend,
      conversations: a.conversations,
      trend: a.trend,
    };
  });
}

// Some agents are configured per-tenant with slightly different names (e.g.
// "Remote Approver" vs "Remote-Approver"). Canonicalize to make the global
// agent leaderboard readable.
const AGENT_NAME_CANONICAL: Record<string, string> = {
  "remote-approver": "Remote Approver",
  "remote approver": "Remote Approver",
  "remote approver aop": "Remote Approver",
};

function canonicalAgentName(name: string): string {
  const key = name.trim().toLowerCase();
  return AGENT_NAME_CANONICAL[key] ?? name.trim();
}

// Standardized agents are explicitly invoked by users (or by deterministic
// workflows tied to procurement intents). AOPs ("Auto-on-PR") fire
// automatically on every PR, so their volume scales with PR throughput, not
// with deliberate usage. We display them in separate tables.
const STANDARDIZED_AGENT_NAMES = new Set([
  "Sourcing Agent",
  "Negotiation Agent",
  "Order Confirmation Agent",
  "Goods Receipt Agent",
  "Contract Agent",
  "Invoice Agent",
]);

export type AgentCategory = "standardized" | "aop";

function categoryOf(agentName: string): AgentCategory {
  return STANDARDIZED_AGENT_NAMES.has(agentName) ? "standardized" : "aop";
}

export async function getAgentUsage(
  category: AgentCategory | "all" = "all",
  limit = 15,
  windowDays = 7
): Promise<AgentUsageRow[]> {
  if (USE_MOCK) {
    const all: AgentUsageRow[] = [
      {
        agentName: "Negotiation Agent",
        tenantId: "covestro",
        displayName: "Covestro",
        logoUrl: null,
        runs: 15,
        trend: { pct: 25, isNew: false },
      },
      {
        agentName: "Sourcing Agent",
        tenantId: "schott",
        displayName: "Schott",
        logoUrl: null,
        runs: 13,
        trend: { pct: 8, isNew: false },
      },
      {
        agentName: "Remote Approver",
        tenantId: "benteler",
        displayName: "Benteler",
        logoUrl: null,
        runs: 1829,
        trend: { pct: -4, isNew: false },
      },
      {
        agentName: "No Touch PR Ariba",
        tenantId: "knorr-bremse",
        displayName: "Knorr Bremse",
        logoUrl: null,
        runs: 753,
        trend: { pct: 12, isNew: false },
      },
    ];
    return all
      .filter((r) => category === "all" || categoryOf(r.agentName) === category)
      .slice(0, limit);
  }

  const dashboard = await db();
  const { usageMetricsCol, tenantsCol } = await import(
    "@/lib/mongodb/collections"
  );

  const { currentStart, currentEnd, previousStart, previousEnd } =
    windowsForRollingNd(windowDays);
  const startKey = dateKey(currentStart);
  const endKey = dateKey(currentEnd);
  const prevStartKey = dateKey(previousStart);
  const prevEndKey = dateKey(previousEnd);

  const fetchPairs = async (
    gte: string,
    lt: string
  ): Promise<Map<string, number>> => {
    const docs = await usageMetricsCol(dashboard)
      .find({
        date: { $gte: gte, $lt: lt },
        agentRunsByName: { $exists: true },
      })
      .project<{ tenantId: string; agentRunsByName: Record<string, number> }>({
        tenantId: 1,
        agentRunsByName: 1,
        _id: 0,
      })
      .toArray();
    const pairs = new Map<string, number>();
    for (const doc of docs) {
      const byName = doc.agentRunsByName ?? {};
      for (const [rawName, rawRuns] of Object.entries(byName)) {
        if (!rawName) continue;
        const runs = Number(rawRuns) || 0;
        if (runs <= 0) continue;
        const agent = canonicalAgentName(rawName);
        if (category !== "all" && categoryOf(agent) !== category) continue;
        const key = `${agent}::${doc.tenantId}`;
        pairs.set(key, (pairs.get(key) ?? 0) + runs);
      }
    }
    return pairs;
  };

  const [currentPairs, previousPairs] = await Promise.all([
    fetchPairs(startKey, endKey),
    fetchPairs(prevStartKey, prevEndKey),
  ]);

  if (!currentPairs.size) return [];

  const ranked = Array.from(currentPairs.entries())
    .map(([key, runs]) => {
      const [agentName, tenantId] = key.split("::");
      return {
        agentName,
        tenantId,
        runs,
        trend: computeTrend(runs, previousPairs.get(key) ?? 0),
      };
    })
    .sort((a, b) => b.runs - a.runs);

  const top = ranked.slice(0, limit);
  if (!top.length) return [];

  const tenantIds = Array.from(new Set(top.map((r) => r.tenantId)));
  const tenants = await tenantsCol(dashboard)
    .find({ tenantId: { $in: tenantIds } })
    .toArray();
  const tenantMap = new Map(tenants.map((t) => [t.tenantId, t]));

  return top.map((r) => {
    const t = tenantMap.get(r.tenantId);
    return {
      agentName: r.agentName,
      tenantId: r.tenantId,
      displayName: t?.displayName ?? r.tenantId,
      logoUrl: t?.logoUrl ?? null,
      runs: r.runs,
      trend: r.trend,
    };
  });
}

export async function getWatchedTenantCount(): Promise<number> {
  if (USE_MOCK) return 96;
  try {
    const dashboard = await db();
    const { tenantsCol } = await import("@/lib/mongodb/collections");
    return tenantsCol(dashboard).estimatedDocumentCount();
  } catch {
    return 0;
  }
}
