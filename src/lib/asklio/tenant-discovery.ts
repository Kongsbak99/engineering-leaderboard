import {
  getDashboardDbName,
  listAllDatabases,
  listDatabaseCollections,
} from "@/lib/mongodb/client";
import { SYSTEM_DATABASE_PREFIXES } from "@/config/scoring";

const REQUIRED_COLLECTIONS = ["common", "config"] as const;
const EXCLUDED_NAME_FRAGMENTS = [
  "demo",
  "workshop",
  "backup",
  "test",
  "sandbox",
  "qa",
  "eval",
  "quality",
] as const;

const BUILTIN_DENYLIST = new Set<string>([
  "new",
  "trado",
  "toitoidixi",
]);

function getDenylist(): Set<string> {
  const envValue = process.env.TENANT_DENYLIST;
  if (!envValue) return BUILTIN_DENYLIST;
  const extra = envValue
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set<string>([...BUILTIN_DENYLIST, ...extra]);
}

export interface DiscoveryFilters {
  excludeDemo?: boolean;
  requireCoreCollections?: boolean;
}

export interface DiscoveryResult {
  tenants: string[];
  skipped: { databaseName: string; reason: string }[];
}

function isSystemDatabase(dbName: string): boolean {
  if (dbName === "admin" || dbName === "local" || dbName === "config") {
    return true;
  }
  if (dbName === getDashboardDbName()) return true;
  if (SYSTEM_DATABASE_PREFIXES.some((p) => dbName.startsWith(p))) return true;
  return false;
}

function hasExcludedFragment(tenantId: string): string | null {
  const lowered = tenantId.toLowerCase();
  for (const fragment of EXCLUDED_NAME_FRAGMENTS) {
    if (lowered.includes(fragment)) return fragment;
  }
  return null;
}

export async function discoverTenantsDetailed(
  filters: DiscoveryFilters = {}
): Promise<DiscoveryResult> {
  const { excludeDemo = true, requireCoreCollections = true } = filters;

  const stage = process.env.ASKLIO_MONGO_STAGE ?? "production";
  const suffix = `-${stage}`;
  const all = await listAllDatabases();
  const denylist = getDenylist();

  const tenants: string[] = [];
  const skipped: { databaseName: string; reason: string }[] = [];

  for (const name of all) {
    if (isSystemDatabase(name)) {
      skipped.push({ databaseName: name, reason: "system database" });
      continue;
    }

    if (!name.endsWith(suffix)) {
      skipped.push({
        databaseName: name,
        reason: `does not match stage suffix '${suffix}'`,
      });
      continue;
    }

    const tenantId = name.slice(0, -suffix.length);
    if (!tenantId) {
      skipped.push({ databaseName: name, reason: "empty tenant id" });
      continue;
    }

    if (denylist.has(tenantId.toLowerCase())) {
      skipped.push({
        databaseName: name,
        reason: "explicitly denylisted",
      });
      continue;
    }

    if (excludeDemo) {
      const fragment = hasExcludedFragment(tenantId);
      if (fragment) {
        skipped.push({
          databaseName: name,
          reason: `name contains '${fragment}'`,
        });
        continue;
      }
    }

    if (requireCoreCollections) {
      try {
        const collections = await listDatabaseCollections(name);
        const present = new Set(collections);
        const missing = REQUIRED_COLLECTIONS.filter((c) => !present.has(c));
        if (missing.length > 0) {
          skipped.push({
            databaseName: name,
            reason: `missing required collection(s): ${missing.join(", ")}`,
          });
          continue;
        }
      } catch (err) {
        skipped.push({
          databaseName: name,
          reason: `failed to list collections: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }
    }

    tenants.push(tenantId);
  }

  tenants.sort();
  return { tenants, skipped };
}

export async function discoverTenants(
  filters: DiscoveryFilters = {}
): Promise<string[]> {
  const { tenants } = await discoverTenantsDetailed(filters);
  return tenants;
}
