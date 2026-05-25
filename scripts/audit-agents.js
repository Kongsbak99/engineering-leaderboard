#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Read-only audit of agent activity across all production askLio tenants
// over the past 7 days. Used to sanity-check the dashboard's customer
// counts in the Agent Usage tables. NO writes anywhere.

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: ".env.local" });

(async () => {
  const client = new MongoClient(process.env.MONGODB_PROD, { maxPoolSize: 25 });
  await client.connect();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  const tenantDbs = databases
    .filter((d) => d.name.endsWith("-production"))
    .filter(
      (d) =>
        !/(demo|workshop|sandbox|test|admin|migrations|local|asd|svgruppe)/.test(
          d.name
        )
    )
    .map((d) => d.name);

  const collections = [
    "sourcing_agent_projects",
    "negotiation_projects",
    "order_confirmations",
    "goods_receipts",
    "contracts_v2",
    "invoices",
  ];

  console.log(
    `Auditing ${tenantDbs.length} tenants x ${collections.length} collections, last 7d...\n`
  );

  const stats = Object.fromEntries(
    collections.map((c) => [c, { tenants: new Set(), totalDocs: 0, perTenant: {} }])
  );

  const tasks = [];
  for (const dbName of tenantDbs) {
    const tenant = dbName.replace("-production", "");
    for (const coll of collections) {
      tasks.push(
        (async () => {
          try {
            const c = await client
              .db(dbName)
              .collection(coll)
              .countDocuments({ created_at: { $gte: since } });
            if (c > 0) {
              stats[coll].tenants.add(tenant);
              stats[coll].totalDocs += c;
              stats[coll].perTenant[tenant] = c;
            }
          } catch (_) {
            /* collection may not exist on this tenant */
          }
        })()
      );
    }
  }
  await Promise.all(tasks);

  console.log("=== Results ===\n");
  for (const [name, s] of Object.entries(stats)) {
    console.log(`${name}: ${s.totalDocs} docs / ${s.tenants.size} tenants`);
    const top = Object.entries(s.perTenant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [t, c] of top) console.log(`   ${t.padEnd(28)} ${c}`);
    console.log();
  }

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
