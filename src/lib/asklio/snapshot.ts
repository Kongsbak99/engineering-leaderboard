import type { Document } from "mongodb";
import { getAsklioDb, getDashboardDb } from "@/lib/mongodb/client";
import {
  goLiveEventsCol,
  tenantSnapshotsCol,
  tenantsCol,
} from "@/lib/mongodb/collections";
import {
  FEATURE_FLAG_KEYS,
  INTEGRATION_KEYS,
  FEATURE_FLAG_DISPLAY_NAMES,
} from "@/config/scoring";
import type { GoLiveCategory } from "@/lib/mongodb/types";
import { getLogoSasUrl } from "@/lib/azure/blob";
import { discoverTenants } from "./tenant-discovery";

function humanizeTenantId(tenantId: string): string {
  const stage = process.env.ASKLIO_MONGO_STAGE || "production";
  const base = tenantId.replace(new RegExp(`-${stage}$`), "");
  return base
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertTenantRecord(
  tenantId: string,
  logoBlobPath: string | null
): Promise<void> {
  const dashboard = await getDashboardDb();
  const displayName = humanizeTenantId(tenantId);

  let logoUrl: string | null = null;
  let logoUpdatedAt: Date | null = null;
  if (logoBlobPath) {
    logoUrl = await getLogoSasUrl(logoBlobPath);
    if (logoUrl) logoUpdatedAt = new Date();
  }

  await tenantsCol(dashboard).updateOne(
    { tenantId },
    {
      $set: {
        tenantId,
        displayName,
        logoBlobPath,
        ...(logoUrl ? { logoUrl, logoUpdatedAt } : {}),
      },
      $setOnInsert: {
        domain: null,
        createdAt: new Date(),
        ...(logoUrl ? {} : { logoUrl: null, logoUpdatedAt: null }),
      },
    },
    { upsert: true }
  );
}

interface SnapshotShape {
  featureFlags: Record<string, boolean | Record<string, boolean>>;
  integrations: Record<string, boolean | Record<string, unknown>>;
  features: Record<string, unknown>;
  activeUserCount: number;
  pendingUserCount: number;
  organisationCount: number;
  publishedAgentConfigCount: number;
}

async function captureTenantSnapshot(tenantId: string): Promise<SnapshotShape> {
  const tenantDb = await getAsklioDb(tenantId);

  const tenantConfigDoc = (await tenantDb
    .collection("common")
    .findOne({ key: "tenant_config" })) as Document | null;

  const customizationDoc = (await tenantDb
    .collection("common")
    .findOne({ key: "customization" })) as Document | null;

  const featureFlags =
    (tenantConfigDoc?.feature_flags as SnapshotShape["featureFlags"]) ?? {};
  const integrations =
    (tenantConfigDoc?.integrations as SnapshotShape["integrations"]) ?? {};
  const features =
    (tenantConfigDoc?.features as Record<string, unknown>) ?? {};

  const logoBlobPath =
    (customizationDoc?.company_logo_url as string | null) ??
    (customizationDoc?.logo_url as string | null) ??
    null;

  await upsertTenantRecord(tenantId, logoBlobPath);

  const [activeUserCount, pendingUserCount, organisationCount, publishedAgentConfigCount] =
    await Promise.all([
      tenantDb.collection("user_configs").countDocuments({ status: "active" }),
      tenantDb.collection("user_configs").countDocuments({ status: "pending" }),
      tenantDb.collection("organisations").countDocuments({ enabled: true }),
      tenantDb
        .collection("agent_config_versions")
        .countDocuments({ published: true }),
    ]);

  return {
    featureFlags,
    integrations,
    features,
    activeUserCount,
    pendingUserCount,
    organisationCount,
    publishedAgentConfigCount,
  };
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if ("enabled" in obj) return obj.enabled === true;
    return Object.values(obj).some((v) => v === true);
  }
  return false;
}

function describeGoLive(
  category: GoLiveCategory,
  tenantName: string,
  field: string
): string {
  const display = FEATURE_FLAG_DISPLAY_NAMES[field] ?? field;
  if (category === "feature_flag")
    return `${display} activated for ${tenantName}`;
  if (category === "integration") {
    const name = field.startsWith("integrations.")
      ? field.slice("integrations.".length)
      : field;
    return `${name.toUpperCase()} integration enabled for ${tenantName}`;
  }
  if (category === "agent_config")
    return `New agent published in ${tenantName}`;
  if (category === "tenant_created")
    return `${tenantName} tenant created`;
  if (category === "user_growth")
    return `Significant user growth in ${tenantName}`;
  return `${field} changed for ${tenantName}`;
}

async function detectGoLives(
  tenantId: string,
  previous: SnapshotShape | null,
  current: SnapshotShape
) {
  const dashboard = await getDashboardDb();
  const tenantName = humanizeTenantId(tenantId);
  const events: {
    tenantId: string;
    tenantName: string;
    category: GoLiveCategory;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    detectedAt: Date;
    description: string;
  }[] = [];

  if (!previous) {
    events.push({
      tenantId,
      tenantName,
      category: "tenant_created",
      field: "tenant",
      oldValue: null,
      newValue: true,
      detectedAt: new Date(),
      description: describeGoLive("tenant_created", tenantName, "tenant"),
    });

    for (const key of FEATURE_FLAG_KEYS) {
      if (isTruthyFlag(current.featureFlags[key])) {
        events.push({
          tenantId,
          tenantName,
          category: "feature_flag",
          field: key,
          oldValue: false,
          newValue: true,
          detectedAt: new Date(),
          description: describeGoLive("feature_flag", tenantName, key),
        });
      }
    }
    for (const key of INTEGRATION_KEYS) {
      if (isTruthyFlag(current.integrations[key])) {
        events.push({
          tenantId,
          tenantName,
          category: "integration",
          field: `integrations.${key}`,
          oldValue: false,
          newValue: true,
          detectedAt: new Date(),
          description: describeGoLive(
            "integration",
            tenantName,
            `integrations.${key}`
          ),
        });
      }
    }
  } else {
    for (const key of FEATURE_FLAG_KEYS) {
      const before = isTruthyFlag(previous.featureFlags[key]);
      const after = isTruthyFlag(current.featureFlags[key]);
      if (!before && after) {
        events.push({
          tenantId,
          tenantName,
          category: "feature_flag",
          field: key,
          oldValue: false,
          newValue: true,
          detectedAt: new Date(),
          description: describeGoLive("feature_flag", tenantName, key),
        });
      }
    }
    for (const key of INTEGRATION_KEYS) {
      const before = isTruthyFlag(previous.integrations[key]);
      const after = isTruthyFlag(current.integrations[key]);
      if (!before && after) {
        events.push({
          tenantId,
          tenantName,
          category: "integration",
          field: `integrations.${key}`,
          oldValue: false,
          newValue: true,
          detectedAt: new Date(),
          description: describeGoLive(
            "integration",
            tenantName,
            `integrations.${key}`
          ),
        });
      }
    }

    const agentDelta =
      current.publishedAgentConfigCount - previous.publishedAgentConfigCount;
    if (agentDelta > 0) {
      events.push({
        tenantId,
        tenantName,
        category: "agent_config",
        field: "published_agents",
        oldValue: previous.publishedAgentConfigCount,
        newValue: current.publishedAgentConfigCount,
        detectedAt: new Date(),
        description: `${agentDelta} new agent${agentDelta > 1 ? "s" : ""} published in ${tenantName}`,
      });
    }

    const userDelta = current.activeUserCount - previous.activeUserCount;
    const userGrowthPct =
      previous.activeUserCount > 0
        ? (userDelta / previous.activeUserCount) * 100
        : 0;
    if (userDelta >= 5 && userGrowthPct >= 25) {
      events.push({
        tenantId,
        tenantName,
        category: "user_growth",
        field: "active_users",
        oldValue: previous.activeUserCount,
        newValue: current.activeUserCount,
        detectedAt: new Date(),
        description: `Active users grew by ${userDelta} (${Math.round(userGrowthPct)}%) in ${tenantName}`,
      });
    }
  }

  if (events.length) {
    await goLiveEventsCol(dashboard).insertMany(events);
  }
  return events.length;
}

export async function snapshotAllTenants(): Promise<{
  tenants: number;
  goLivesDetected: number;
  errors: { tenantId: string; error: string }[];
}> {
  const dashboard = await getDashboardDb();
  const tenants = await discoverTenants();
  const errors: { tenantId: string; error: string }[] = [];
  let goLivesDetected = 0;

  for (const tenantId of tenants) {
    try {
      const latestPrev = await tenantSnapshotsCol(dashboard)
        .find({ tenantId })
        .sort({ snapshotAt: -1 })
        .limit(1)
        .toArray();
      const previous = latestPrev[0] ?? null;

      const snapshot = await captureTenantSnapshot(tenantId);
      await tenantSnapshotsCol(dashboard).insertOne({
        tenantId,
        snapshotAt: new Date(),
        ...snapshot,
      });

      goLivesDetected += await detectGoLives(
        tenantId,
        previous
          ? {
              featureFlags: previous.featureFlags,
              integrations: previous.integrations,
              features: previous.features,
              activeUserCount: previous.activeUserCount,
              pendingUserCount: previous.pendingUserCount,
              organisationCount: previous.organisationCount,
              publishedAgentConfigCount: previous.publishedAgentConfigCount,
            }
          : null,
        snapshot
      );
    } catch (err) {
      errors.push({
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    tenants: tenants.length,
    goLivesDetected,
    errors,
  };
}
