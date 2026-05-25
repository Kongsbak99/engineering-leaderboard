import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getDashboardDb, getDashboardDbName } = await import(
      "@/lib/mongodb/client"
    );
    const { ensureIndexes, COLLECTIONS } = await import(
      "@/lib/mongodb/collections"
    );
    const { discoverTenantsDetailed } = await import(
      "@/lib/asklio/tenant-discovery"
    );

    const db = await getDashboardDb();
    await ensureIndexes(db);

    const discovery = await discoverTenantsDetailed();

    return NextResponse.json({
      ok: true,
      dashboardDatabase: getDashboardDbName(),
      collectionsEnsured: Object.values(COLLECTIONS),
      tenantsFound: discovery.tenants.length,
      tenants: discovery.tenants,
      skippedCount: discovery.skipped.length,
      skippedSample: discovery.skipped.slice(0, 20),
    });
  } catch (error) {
    console.error("Admin init failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
