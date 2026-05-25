import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getDashboardDb } = await import("@/lib/mongodb/client");
    const { projectScoresCol } = await import("@/lib/mongodb/collections");
    const { computeProjectMomentumScores } = await import(
      "@/lib/scoring/project"
    );

    const db = await getDashboardDb();
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const currentStart = new Date(now.getTime() - 7 * DAY_MS);
    const previousStart = new Date(currentStart.getTime() - 7 * DAY_MS);

    const projectScores = await computeProjectMomentumScores(
      db,
      currentStart,
      now,
      previousStart
    );

    let upsertedProjects = 0;
    for (const score of projectScores) {
      await projectScoresCol(db).updateOne(
        { linearProjectId: score.linearProjectId, date: score.date },
        { $set: score },
        { upsert: true }
      );
      upsertedProjects++;
    }

    return NextResponse.json({ ok: true, projects: upsertedProjects });
  } catch (error) {
    console.error("Score computation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
