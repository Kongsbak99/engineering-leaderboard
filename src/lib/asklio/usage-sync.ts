import { getAsklioDb, getDashboardDb } from "@/lib/mongodb/client";
import { usageMetricsCol } from "@/lib/mongodb/collections";
import { discoverTenants } from "./tenant-discovery";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function captureTenantUsage(
  tenantId: string,
  date: Date
): Promise<void> {
  const tenantDb = await getAsklioDb(tenantId);
  const dashboard = await getDashboardDb();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dateKey = dayStart.toISOString().split("T")[0];

  const [
    conversations,
    purchaseRequests,
    itemSearches,
    agentRuns,
    agentRunsByNameAgg,
    feedbackPositive,
    feedbackNegative,
    activeUserSamples,
    spendAgg,
  ] = await Promise.all([
    tenantDb.collection("conversations").countDocuments({
      created_at: { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb.collection("purchase_requests").countDocuments({
      created_at: { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb.collection("item_searches").countDocuments({
      "meta.created_at": { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb.collection("agent_runs").countDocuments({
      started_at: { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb
      .collection("agent_runs")
      .aggregate([
        { $match: { started_at: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$name", count: { $sum: 1 } } },
      ])
      .toArray() as Promise<{ _id: string | null; count: number }[]>,
    tenantDb.collection("feedback").countDocuments({
      impression: "positive",
      created_at: { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb.collection("feedback").countDocuments({
      impression: "negative",
      created_at: { $gte: dayStart, $lte: dayEnd },
    }),
    tenantDb
      .collection("conversations")
      .aggregate([
        { $match: { created_at: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$created_by" } },
        { $count: "users" },
      ])
      .toArray() as Promise<{ users: number }[]>,
    tenantDb
      .collection("purchase_requests")
      .aggregate([
        {
          $match: {
            submitted_at: { $gte: dayStart, $lte: dayEnd },
            total_cost_eur: { $ne: null },
          },
        },
        { $group: { _id: null, total: { $sum: "$total_cost_eur" } } },
      ])
      .toArray() as Promise<{ total: number }[]>,
  ]);

  const activeUsers = activeUserSamples[0]?.users ?? 0;
  const totalSpend = spendAgg[0]?.total ?? 0;

  const agentRunsByName: Record<string, number> = {};
  for (const row of agentRunsByNameAgg) {
    if (!row._id) continue;
    agentRunsByName[row._id] = row.count;
  }

  await usageMetricsCol(dashboard).updateOne(
    { tenantId, date: dateKey },
    {
      $set: {
        tenantId,
        date: dateKey,
        conversations,
        purchaseRequests,
        itemSearches,
        activeUsers,
        agentRuns,
        agentRunsByName,
        feedbackPositive,
        feedbackNegative,
        totalSpend,
        capturedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function syncUsage(daysBack = 1): Promise<{
  tenants: number;
  daysSynced: number;
  errors: { tenantId: string; error: string }[];
}> {
  const tenants = await discoverTenants();
  const errors: { tenantId: string; error: string }[] = [];

  for (const tenantId of tenants) {
    try {
      for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await captureTenantUsage(tenantId, date);
      }
    } catch (err) {
      errors.push({
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    tenants: tenants.length,
    daysSynced: daysBack,
    errors,
  };
}
