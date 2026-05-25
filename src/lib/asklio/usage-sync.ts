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

  const dayWindow = { $gte: dayStart, $lte: dayEnd };

  const [
    conversations,
    purchaseRequests,
    itemSearches,
    agentRunsByNameAgg,
    sourcingAgentCount,
    negotiationAgentCount,
    orderConfirmationCount,
    goodsReceiptCount,
    contractAgentCount,
    invoiceAgentCount,
    feedbackPositive,
    feedbackNegative,
    activeUserSamples,
    spendAgg,
  ] = await Promise.all([
    tenantDb.collection("conversations").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("purchase_requests").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("item_searches").countDocuments({ "meta.created_at": dayWindow }),
    tenantDb
      .collection("agent_runs")
      .aggregate([
        {
          $match: {
            started_at: dayWindow,
            $or: [{ test_run_type: null }, { test_run_type: { $exists: false } }],
            name: { $not: /^Test run:/i },
          },
        },
        { $group: { _id: "$name", count: { $sum: 1 } } },
      ])
      .toArray() as Promise<{ _id: string | null; count: number }[]>,
    tenantDb.collection("sourcing_agent_projects").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("negotiation_projects").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("order_confirmations").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("goods_receipts").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("contracts_v2").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("invoices").countDocuments({ created_at: dayWindow }),
    tenantDb.collection("feedback").countDocuments({
      impression: "positive",
      created_at: dayWindow,
    }),
    tenantDb.collection("feedback").countDocuments({
      impression: "negative",
      created_at: dayWindow,
    }),
    tenantDb
      .collection("conversations")
      .aggregate([
        { $match: { created_at: dayWindow } },
        { $group: { _id: "$created_by" } },
        { $count: "users" },
      ])
      .toArray() as Promise<{ users: number }[]>,
    tenantDb
      .collection("purchase_requests")
      .aggregate([
        {
          $match: {
            submitted_at: dayWindow,
            total_cost_in_base_currency: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total_cost_in_base_currency" },
          },
        },
      ])
      .toArray() as Promise<{ total: number }[]>,
  ]);

  const activeUsers = activeUserSamples[0]?.users ?? 0;
  const totalSpend = spendAgg[0]?.total ?? 0;

  const agentRunsByName: Record<string, number> = {};
  for (const row of agentRunsByNameAgg) {
    if (!row._id) continue;
    agentRunsByName[row._id] = (agentRunsByName[row._id] ?? 0) + row.count;
  }

  const addAgent = (name: string, count: number) => {
    if (count > 0) agentRunsByName[name] = (agentRunsByName[name] ?? 0) + count;
  };
  addAgent("Sourcing Agent", sourcingAgentCount);
  addAgent("Negotiation Agent", negotiationAgentCount);
  addAgent("Order Confirmation Agent", orderConfirmationCount);
  addAgent("Goods Receipt Agent", goodsReceiptCount);
  addAgent("Contract Agent", contractAgentCount);
  addAgent("Invoice Agent", invoiceAgentCount);

  const agentRuns = Object.values(agentRunsByName).reduce((s, n) => s + n, 0);

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
