#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Mirrors what `getProjectMomentum(15)` does so we can see the trend math
// for the top 15 projects on screen.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "implementation-dashboard";

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const scores = db.collection("project_scores");
    const projects = db.collection("projects");

    const latest = await scores.find({}).sort({ date: -1 }).limit(1).toArray();
    if (!latest.length) {
      console.log("No project_scores rows");
      return;
    }
    const latestDate = latest[0].date;

    const top = await scores
      .find({ date: latestDate })
      .sort({ momentumScore: -1 })
      .limit(15)
      .toArray();

    const ids = top.map((s) => s.linearProjectId);
    const priors = await scores
      .find({ linearProjectId: { $in: ids }, date: { $lt: latestDate } })
      .sort({ date: -1 })
      .toArray();
    const priorByProject = new Map();
    for (const p of priors) {
      if (!priorByProject.has(p.linearProjectId)) {
        priorByProject.set(p.linearProjectId, p);
      }
    }

    const projectRows = await projects
      .find({ linearProjectId: { $in: ids } })
      .toArray();
    const nameById = new Map(projectRows.map((p) => [p.linearProjectId, p.name]));

    console.log(`Latest date: ${latestDate}`);
    console.log(
      [
        "rank".padEnd(5),
        "today".padStart(6),
        "prior".padStart(6),
        "priorDate".padEnd(12),
        "mock".padEnd(5),
        "trendPct".padStart(9),
        "name",
      ].join(" | ")
    );
    top.forEach((s, i) => {
      const prior = priorByProject.get(s.linearProjectId);
      const previous = prior?.momentumScore;
      const pct =
        previous === undefined
          ? "—"
          : previous === 0
            ? "new"
            : (((s.momentumScore - previous) / Math.abs(previous)) * 100).toFixed(1);
      console.log(
        [
          String(i + 1).padEnd(5),
          String(s.momentumScore).padStart(6),
          String(previous ?? "—").padStart(6),
          (prior?.date ?? "—").padEnd(12),
          String(prior?.mock === true).padEnd(5),
          String(pct).padStart(9),
          nameById.get(s.linearProjectId) ?? s.linearProjectId,
        ].join(" | ")
      );
    });
  } finally {
    await client.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
