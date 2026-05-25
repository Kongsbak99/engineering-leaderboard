import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "true";

  try {
    const { discoverTenantsDetailed } = await import(
      "@/lib/asklio/tenant-discovery"
    );
    const result = await discoverTenantsDetailed();
    return NextResponse.json({
      ok: true,
      stage: process.env.ASKLIO_MONGO_STAGE ?? "production",
      tenantCount: result.tenants.length,
      tenants: result.tenants,
      skippedCount: result.skipped.length,
      ...(verbose ? { skipped: result.skipped } : {}),
    });
  } catch (error) {
    console.error("Tenant discovery failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
