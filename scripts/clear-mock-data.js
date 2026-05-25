#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Removes everything inserted by scripts/seed-mock-data.js.
// Targets only documents tagged with `mock: true`, so real synced
// data is never touched.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "implementation-dashboard";

if (!URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

const COLLECTIONS_TO_CLEAN = [
  "go_live_events",
  "usage_metrics",
  "tenants",
  "tenant_snapshots",
  "project_scores",
];

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const summary = {};
    for (const coll of COLLECTIONS_TO_CLEAN) {
      const result = await db.collection(coll).deleteMany({ mock: true });
      summary[coll] = result.deletedCount;
    }
    console.log(JSON.stringify({ dbName: DB_NAME, deleted: summary }, null, 2));
  } finally {
    await client.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
