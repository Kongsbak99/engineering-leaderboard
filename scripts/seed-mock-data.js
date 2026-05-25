#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Seeds mock data into the dashboard (staging) MongoDB so the dashboard
// looks lively in demos. Every document is tagged with `mock: true`, so
// `npm run mock:clear` (or scripts/clear-mock-data.js) can wipe them later.
//
// Inserts:
//   - go_live_events: ~12 believable activations spread across the last
//     6 days, using real tenant IDs so logos resolve.
//
// Safe to re-run: this script wipes existing { mock: true } docs in
// go_live_events before inserting fresh ones, so counts stay stable.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "implementation-dashboard";

if (!URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

// Tenant IDs below are real (so logos resolve out of the `tenants`
// collection). Categories + fields mirror what the real snapshot job
// would emit when a flag flips on.
const GO_LIVE_SEEDS = [
  {
    tenantId: "covestro",
    tenantName: "Covestro",
    category: "feature_flag",
    field: "negotiation_agent_v2",
    description: "Negotiation Agent v2 activated for Covestro",
    hoursAgo: 4,
  },
  {
    tenantId: "schaeffler",
    tenantName: "Schaeffler",
    category: "feature_flag",
    field: "sourcing_agent",
    description: "Sourcing Agent activated for Schaeffler",
    hoursAgo: 11,
  },
  {
    tenantId: "brose",
    tenantName: "Brose",
    category: "feature_flag",
    field: "order_confirmations",
    description: "Order Confirmation Agent activated for Brose",
    hoursAgo: 22,
  },
  {
    tenantId: "benteler",
    tenantName: "Benteler",
    category: "agent_config",
    field: "published_agents",
    description: "2 new agents published in Benteler",
    hoursAgo: 30,
  },
  {
    tenantId: "knorr-bremse",
    tenantName: "Knorr Bremse",
    category: "integration",
    field: "integrations.ariba",
    description: "ARIBA integration enabled for Knorr Bremse",
    hoursAgo: 38,
  },
  {
    tenantId: "schott",
    tenantName: "Schott",
    category: "feature_flag",
    field: "goods_receipts",
    description: "Goods Receipt Agent activated for Schott",
    hoursAgo: 53,
  },
  {
    tenantId: "dhl",
    tenantName: "DHL",
    category: "integration",
    field: "integrations.sap",
    description: "SAP integration enabled for DHL",
    hoursAgo: 64,
  },
  {
    tenantId: "ergo",
    tenantName: "Ergo",
    category: "feature_flag",
    field: "guidance_chat",
    description: "Guidance Chat activated for Ergo",
    hoursAgo: 78,
  },
  {
    tenantId: "burda",
    tenantName: "Burda",
    category: "feature_flag",
    field: "negotiation_agent_v2",
    description: "Negotiation Agent v2 activated for Burda",
    hoursAgo: 96,
  },
  {
    tenantId: "dormakaba",
    tenantName: "Dormakaba",
    category: "feature_flag",
    field: "sourcing_agent",
    description: "Sourcing Agent activated for Dormakaba",
    hoursAgo: 110,
  },
  {
    tenantId: "galenica",
    tenantName: "Galenica",
    category: "integration",
    field: "integrations.oci",
    description: "OCI integration enabled for Galenica",
    hoursAgo: 128,
  },
  {
    tenantId: "munichre",
    tenantName: "Munich Re",
    category: "feature_flag",
    field: "forms",
    description: "Forms activated for Munich Re",
    hoursAgo: 142,
  },
];

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);

    const goLives = db.collection("go_live_events");
    const wiped = await goLives.deleteMany({ mock: true });

    const now = Date.now();
    const docs = GO_LIVE_SEEDS.map((s) => ({
      tenantId: s.tenantId,
      tenantName: s.tenantName,
      category: s.category,
      field: s.field,
      oldValue: false,
      newValue: true,
      detectedAt: new Date(now - s.hoursAgo * 60 * 60 * 1000),
      description: s.description,
      mock: true,
    }));

    const result = await goLives.insertMany(docs);

    console.log(
      JSON.stringify(
        {
          dbName: DB_NAME,
          go_live_events: {
            wipedMock: wiped.deletedCount,
            inserted: result.insertedCount,
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
