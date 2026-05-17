import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getServiceClient } = await import("@/lib/supabase/client");
    const { computeDeliveryScores } = await import("@/lib/scoring/delivery");
    const { computeCollaborationScores } = await import("@/lib/scoring/collaboration");
    const supabase = getServiceClient();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startDate = startOfWeek.toISOString();
    const endDate = now.toISOString();
    const today = now.toISOString().split("T")[0];

    const [deliveryScores, collabScores] = await Promise.all([
      computeDeliveryScores(supabase, startDate, endDate),
      computeCollaborationScores(supabase, startDate, endDate),
    ]);

    const { data: engineers } = await supabase.from("engineers").select("id");

    let upserted = 0;
    for (const eng of engineers ?? []) {
      const deliveryScore = deliveryScores.get(eng.id) ?? 0;
      const collabScore = collabScores.get(eng.id) ?? 0;

      // Aggregate additional metrics for the snapshot
      const { count: prsMerged } = await supabase
        .from("pull_requests")
        .select("id", { count: "exact", head: true })
        .eq("engineer_id", eng.id)
        .eq("state", "merged")
        .gte("merged_at", startDate);

      const { count: reviewsGiven } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_id", eng.id)
        .gte("submitted_at", startDate);

      const { count: commitsCount } = await supabase
        .from("commits")
        .select("id", { count: "exact", head: true })
        .eq("engineer_id", eng.id)
        .gte("committed_at", startDate);

      const { data: commitStats } = await supabase
        .from("commits")
        .select("lines_added, lines_removed")
        .eq("engineer_id", eng.id)
        .gte("committed_at", startDate);

      const linesAdded = (commitStats ?? []).reduce(
        (sum, c) => sum + (c.lines_added ?? 0),
        0
      );
      const linesRemoved = (commitStats ?? []).reduce(
        (sum, c) => sum + (c.lines_removed ?? 0),
        0
      );

      await supabase.from("daily_snapshots").upsert(
        {
          date: today,
          engineer_id: eng.id,
          delivery_score: deliveryScore,
          collaboration_score: collabScore,
          prs_merged: prsMerged ?? 0,
          reviews_given: reviewsGiven ?? 0,
          commits_count: commitsCount ?? 0,
          lines_added: linesAdded,
          lines_removed: linesRemoved,
        },
        { onConflict: "date,engineer_id" }
      );
      upserted++;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (error) {
    console.error("Score computation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
