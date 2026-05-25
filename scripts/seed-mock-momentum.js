#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Seeds mock *prior* project scores so that the Project Momentum table
// shows a believable mix of up/down trend arrows for the demo. The real
// "today" rollup is left untouched - we only fabricate yesterday's row
// for each project so the WoW percent trend in `getProjectMomentum`
// resolves to something interesting.
//
// Every inserted document is tagged `mock: true` and lives at
// `date = yesterday`. Re-running this script first deletes existing
// `mock: true` rows in `project_scores` and then re-inserts.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "implementation-dashboard";

if (!URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

// Hand-picked deltas to produce a believable mix of up/down arrows on
// the demo screen. Applied to projects ordered by current Lio Score
// (descending), so the top project gets the first entry, etc. If there
// are more projects than entries, we cycle through the list. The mix
// is intentionally weighted slightly green: top projects feel like
// they're winning the week, with a couple of stark drops mixed in.
const DELTA_PCTS = [
  22, -9, 34, 5, -14, 41, -22, 12, -4, 18, -28, 16, 3, 27, -17,
];

function dateKey(d) {
  return d.toISOString().split("T")[0];
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const scores = db.collection("project_scores");

    // Always start from a clean slate so reruns produce identical state.
    const wiped = await scores.deleteMany({ mock: true });

    const latestRow = await scores
      .find({})
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    if (!latestRow.length) {
      console.log(
        JSON.stringify(
          {
            dbName: DB_NAME,
            project_scores: {
              wipedMock: wiped.deletedCount,
              inserted: 0,
              note: "No real project_scores found; nothing to seed against.",
            },
          },
          null,
          2
        )
      );
      return;
    }

    const latestDate = latestRow[0].date;
    const today = new Date(`${latestDate}T00:00:00Z`);
    const priorDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const priorKey = dateKey(priorDate);

    const todayScores = await scores
      .find({ date: latestDate })
      .sort({ momentumScore: -1 })
      .toArray();

    const docs = todayScores.map((s, i) => {
      const delta = DELTA_PCTS[i % DELTA_PCTS.length];
      // current = previous * (1 + delta/100) => previous = current / (1 + delta/100)
      // Clamp to [1, 100] so the score bar stays in range.
      const previous = Math.max(
        1,
        Math.min(100, Math.round(s.momentumScore / (1 + delta / 100)))
      );
      return {
        linearProjectId: s.linearProjectId,
        date: priorKey,
        momentumScore: previous,
        // The rest of the fields are not used by the dashboard's
        // percent-trend computation, but we set them to plausible
        // values so the doc shape matches the real schema.
        trend: 0,
        components: s.components ?? {
          ticketVelocity: 0,
          ticketThroughput: 0,
          cycleTimeEfficiency: 0,
          codeVolume: 0,
          prThroughput: 0,
          adoption: 0,
          userTraction: 0,
        },
        ticketsCompleted: 0,
        ticketsCreated: 0,
        blockedCount: 0,
        prsMerged: 0,
        linesChanged: 0,
        goLiveCount: 0,
        capturedAt: new Date(),
        mock: true,
      };
    });

    // Upsert keyed on (linearProjectId, date) so we own that row even
    // if a real prior happened to exist there.
    let inserted = 0;
    for (const doc of docs) {
      const res = await scores.updateOne(
        { linearProjectId: doc.linearProjectId, date: doc.date },
        { $set: doc },
        { upsert: true }
      );
      if (res.upsertedCount > 0 || res.modifiedCount > 0) inserted++;
    }

    console.log(
      JSON.stringify(
        {
          dbName: DB_NAME,
          project_scores: {
            wipedMock: wiped.deletedCount,
            latestDate,
            priorDate: priorKey,
            projects: todayScores.length,
            upserted: inserted,
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
