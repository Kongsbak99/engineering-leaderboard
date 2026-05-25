#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Read-only audit: how much historical data is already in the dashboard DB?
// Used to decide whether a real backfill (`usage-sync?days=14` + `scores
// ?backdate=1`) will produce believable WoW trends, or whether we still need
// mock priors as a fallback.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "implementation-dashboard";

if (!URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);

    const usageDates = await db
      .collection("usage_metrics")
      .aggregate([
        { $group: { _id: "$date", tenants: { $addToSet: "$tenantId" } } },
        { $project: { date: "$_id", _id: 0, tenants: { $size: "$tenants" } } },
        { $sort: { date: 1 } },
      ])
      .toArray();

    const scoreDates = await db
      .collection("project_scores")
      .aggregate([
        {
          $group: {
            _id: "$date",
            projects: { $sum: 1 },
            mocks: {
              $sum: { $cond: [{ $eq: ["$mock", true] }, 1, 0] },
            },
          },
        },
        { $project: { date: "$_id", _id: 0, projects: 1, mocks: 1 } },
        { $sort: { date: 1 } },
      ])
      .toArray();

    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - TWO_WEEKS);

    const [linearCreated, linearCompleted, prsMerged, goLives] =
      await Promise.all([
        db
          .collection("linear_issues")
          .countDocuments({ createdAt: { $gte: cutoff } }),
        db
          .collection("linear_issues")
          .countDocuments({ completedAt: { $gte: cutoff } }),
        db
          .collection("pull_requests")
          .countDocuments({ mergedAt: { $gte: cutoff } }),
        db
          .collection("go_live_events")
          .countDocuments({ detectedAt: { $gte: cutoff } }),
      ]);

    console.log(
      JSON.stringify(
        {
          dbName: DB_NAME,
          usage_metrics: {
            distinctDates: usageDates.length,
            range:
              usageDates.length > 0
                ? `${usageDates[0].date} → ${usageDates[usageDates.length - 1].date}`
                : "—",
            perDate: usageDates,
          },
          project_scores: {
            distinctDates: scoreDates.length,
            perDate: scoreDates,
          },
          last14d: {
            linearIssuesCreated: linearCreated,
            linearIssuesCompleted: linearCompleted,
            prsMerged,
            goLives,
          },
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
