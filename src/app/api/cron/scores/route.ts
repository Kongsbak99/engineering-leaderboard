import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `?backdate=N` lets us replay scoring as if today were N days ago. Used to
  // generate a real prior rollup for the trend column without waiting for the
  // next cron run. `N=0` (the default) is the live cron behaviour.
  const url = new URL(req.url);
  const backdate = Math.max(
    0,
    Math.min(30, parseInt(url.searchParams.get("backdate") ?? "0", 10) || 0)
  );

  try {
    const { getDashboardDb } = await import("@/lib/mongodb/client");
    const { projectScoresCol } = await import("@/lib/mongodb/collections");
    const { computeProjectMomentumScores } = await import(
      "@/lib/scoring/project"
    );

    const db = await getDashboardDb();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const endDate = new Date(Date.now() - backdate * DAY_MS);
    const currentStart = new Date(endDate.getTime() - 7 * DAY_MS);
    const previousStart = new Date(currentStart.getTime() - 7 * DAY_MS);

    const projectScores = await computeProjectMomentumScores(
      db,
      currentStart,
      endDate,
      previousStart
    );

    let upsertedProjects = 0;
    for (const score of projectScores) {
      await projectScoresCol(db).updateOne(
        { linearProjectId: score.linearProjectId, date: score.date },
        // `$unset: { mock: "" }` scrubs the mock flag if we're overwriting a
        // demo-seeded prior with real numbers - so the next `mock:clear`
        // can't accidentally wipe a real rollup.
        { $set: score, $unset: { mock: "" } },
        { upsert: true }
      );
      upsertedProjects++;
    }

    return NextResponse.json({
      ok: true,
      projects: upsertedProjects,
      backdate,
      date: endDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Score computation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
