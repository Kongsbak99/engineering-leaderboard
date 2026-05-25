# Lio Pulse

A single-page, dark-themed dashboard for the office TV. Combines **Linear**,
**GitHub**, the **askLio production MongoDB**, and **Azure Blob Storage** (for
tenant logos) into three stacked sections:

1. **KPI strip** with rolling 7-day vs prior 7-day deltas (cycle time, PRs
   merged, average daily active users, new go-lives)
2. **Rolling go-live banner** showing recent tenant module activations with
   company logos
3. **Four tables side-by-side** — Project Momentum, Customer Usage, AGENTS,
   AOPs

Every table also carries a **Trend** column: a green ▲ / red ▼ with the
percent change of that row's primary metric between the rolling 7-day window
and the prior 7-day window. A `★ new` badge appears when a row has activity
this week but zero in the previous window.

By design there are **no person-scoped views** — the dashboard surfaces only
team-, project-, and customer-level signals.

## The four tables

All four bottom tables operate on a **rolling 7-day window** (now − 7d → now)
and compute a WoW trend against the **prior 7-day window** (now − 14d → now − 7d).

### 1. Project Momentum

> Which initiatives have the most momentum behind them right now?

**Columns:** `#` · `Project` · `Lio Score` · `Trend`

**Source.** A daily rollup written by `/api/cron/scores` into `project_scores`.
It joins data from four pipelines for each Linear project:

| Component             | Weight | Inputs                                                  |
| --------------------- | ------ | ------------------------------------------------------- |
| `ticketVelocity`      | 20%    | Sum of completed Linear estimates                       |
| `ticketThroughput`    | 15%    | Count of Linear issues moved to Done                    |
| `cycleTimeEfficiency` | 15%    | Inverse of avg cycle time (faster = better)             |
| `codeVolume`          | 10%    | Lines changed across merged GitHub PRs                  |
| `prThroughput`        | 15%    | Count of merged GitHub PRs                              |
| `adoption`            | 15%    | Tenant-level go-lives matching this project's mapping   |
| `userTraction`        | 10%    | Δ in active users on mapped tenants vs prior window     |

Each component is **min-max normalised across all scored projects** in the
current run (so the project with the most PRs gets 100 for `prThroughput`,
the slowest cycle time gets 0 for `cycleTimeEfficiency`, etc.), then combined
into the `Lio Score` (0–100) using the weights above.

**Trend.** Percent change of the Lio Score vs the most recent prior rollup
for that project: `(today_score − previous_score) / previous_score × 100`.

**Ranking.** Sorted by Lio Score descending; top 15 are shown.

**Project mappings.** `adoption` and `userTraction` require a row in
`project_mappings` connecting a Linear project to feature flags / integrations /
tenant IDs. Without a mapping, those two components score 0 for that project.

### 2. Customer Usage

> Which tenants are getting the most real value out of askLio this week?

**Columns:** `Customer` · `DAU` · `PRs` · `Trend`

**Source.** Daily per-tenant aggregates in `usage_metrics`, populated by
`/api/cron/usage-sync`. The cron reads each tenant's production MongoDB:
- `DAU` = average of `activeUsers` across the 7-day window
- `PRs` = sum of `purchaseRequests` across the 7-day window

**Ranking.** Tenants are ranked by an **engagement score**:

```
engagement = √(DAU × PRs)
```

The geometric mean requires **both** dimensions to matter: 100 daily users
that don't create any requests rank the same as 0 users (≈ 0); a tenant
with 30 users creating 1,000 PRs ranks high. **Spend is deliberately
ignored** here — it tracks contract size, not whether users are happy.

**Trend.** WoW percent change of the engagement score.

Top 15 tenants are shown.

### 3. AGENTS

> Which (agent, customer) pairs are the most active this week?

**Columns:** `Agent` · `Customer` · `Runs` · `Trend`

**Source.** The `agentRunsByName` map on `usage_metrics`, populated by
`/api/cron/usage-sync` from per-tenant agent collections (`agent_runs`,
`sourcing_agent_projects`, `negotiation_projects`, etc.). Test runs and
runs without a `name` are filtered out.

This table is restricted to **standardised user-triggered agents**:

- `Sourcing Agent`
- `Negotiation Agent`
- `Order Confirmation Agent`
- `Goods Receipt Agent`
- `Contract Agent`
- `Invoice Agent`

Names are canonicalised so per-tenant naming variations collapse into the
same row (`"Remote Approver"` and `"Remote-Approver"` → same canonical name).

**Ranking.** Each row is a single `(agent, customer)` pair, sorted by `Runs`
descending. Top 15 pairs are shown.

**Trend.** WoW percent change in `Runs` for that exact `(agent, customer)`
pair.

### 4. AOPs

> Which automated-on-PR agents are firing the most, and where?

Identical shape and ranking as the AGENTS table, but covers everything
**not** in the standardised list above. These agents (Remote Approver,
PR Reviewer, etc.) trigger automatically on every purchase request, so
their absolute run counts dwarf user-triggered agents — separating them
keeps both tables readable.

---

## Architecture

```
GitHub API    ─┐
Linear API    ─┼─► Cron sync ─► Dashboard MongoDB ─► RSC one-pager  (TV)
askLio Mongo  ─┘                       ▲
Azure Blob   ──── SAS URLs for logos ──┘
```

| Cron                          | Schedule              | Purpose                                                              |
| ----------------------------- | --------------------- | -------------------------------------------------------------------- |
| `/api/cron/github`            | `*/15 8-18 * * 1-5`   | Sync PRs, commits, reviews, lifecycle events from `GITHUB_REPOS`     |
| `/api/cron/linear`            | `*/15 8-18 * * 1-5`   | Sync issues + every state transition (rate-limit-aware retries)      |
| `/api/cron/tenant-snapshot`   | `0 */2 * * *`         | Snapshot tenant configs + detect go-lives + refresh logo SAS URLs    |
| `/api/cron/usage-sync`        | `30 3 * * *`          | Aggregate per-tenant usage (incl. per-agent run counts)              |
| `/api/cron/scores`            | `0 */6 * * *`         | Compute project momentum scores                                      |

Run any cron manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/scores
```

## Pages

Only one user-facing route:

| Route | Description                                |
| ----- | ------------------------------------------ |
| `/`   | The full dashboard. That's it. Hang on TV. |

## Environment variables

See [`.env.local.example`](.env.local.example).

| Variable                       | Required | Purpose                                                                 |
| ------------------------------ | -------- | ----------------------------------------------------------------------- |
| `MONGODB_URI`                  | yes      | Dashboard's own R/W database (can be a separate staging cluster)        |
| `MONGODB_DB_NAME`              |          | DB name (default `implementation-dashboard`)                            |
| `MONGODB_PROD`                 |          | Optional R/O connection to the askLio production cluster for tenant DBs |
| `ASKLIO_MONGO_STAGE`           | yes      | `production` / `staging` / `dev` — which tenant DBs to read             |
| `TENANT_DENYLIST`              |          | Comma-separated extra tenant IDs to skip                                |
| `GITHUB_TOKEN`, `GITHUB_ORG`   | yes      | GitHub API access                                                       |
| `GITHUB_REPOS`                 |          | Comma-separated repo names within `GITHUB_ORG` (e.g. `askLio`)          |
| `LINEAR_API_KEY`               | yes      | Linear API                                                              |
| `CRON_SECRET`                  | yes      | Auth header for cron / curl                                             |
| `AZURE_STORAGE_ACCOUNT_URL`    | yes\*    | Azure blob endpoint (for tenant logos)                                  |
| `AZURE_STORAGE_ACCESS_KEY`     | yes\*    | Azure shared key                                                        |

\* If Azure vars are unset, tenants render with initials instead of logos —
the dashboard still functions.

If `MONGODB_URI` is unset, the dashboard runs in **mock mode** with sample
fixtures.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in values
npm run dev                        # http://localhost:3000
```

### First-time data backfill

```bash
TOKEN="$CRON_SECRET"
BASE="http://localhost:3000/api/cron"

curl -H "Authorization: Bearer $TOKEN" "$BASE/tenant-snapshot" | jq  # creates tenants + first snapshot
curl -H "Authorization: Bearer $TOKEN" "$BASE/usage-sync?days=14" | jq  # 2 weeks of usage for WoW
curl -H "Authorization: Bearer $TOKEN" "$BASE/linear" | jq
curl -H "Authorization: Bearer $TOKEN" "$BASE/github" | jq
curl -H "Authorization: Bearer $TOKEN" "$BASE/scores" | jq
```

### Demo data

For demos before enough historical data has accumulated, mock fixtures can
be seeded directly into the dashboard's MongoDB. Every seeded document is
tagged `mock: true` and lives only in the dashboard DB — production is
**never** written to.

```bash
npm run mock:seed            # go-lives + prior project scores
npm run mock:seed:momentum   # only the project-momentum priors
npm run mock:clear           # remove everything tagged mock:true
```

- `mock:seed` inserts ~12 believable go-live events spread across the last
  6 days plus a prior `project_scores` row for every currently-scored
  project (so trend arrows show a believable mix of ▲ and ▼).
- `mock:clear` deletes every `mock: true` document from `go_live_events`,
  `usage_metrics`, `tenants`, `tenant_snapshots`, and `project_scores`.

The mock momentum priors don't replace real data — they live at
`date = today − 1` and are picked up by `getProjectMomentum`'s percent-trend
computation. Re-running `mock:seed:momentum` is idempotent (existing
`mock: true` rows are deleted first).

### Tenant discovery rules

Only databases matching **all** of these are considered real tenants:

- Name ends with `-${ASKLIO_MONGO_STAGE}` (e.g. `-production`)
- Name does **not** contain `demo`, `workshop`, `backup`, `test`, `sandbox`,
  `qa`, `eval`, `quality`
- Not a system DB (`admin`, `local`, `config`, `supplier-portal-*`)
- Not the dashboard's own DB
- Has both `common` and `config` collections inside

Preview discovery:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/admin/tenants?verbose=true"
```

### Collections in the dashboard database

| Collection            | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `tenants`             | One row per tenant with `displayName`, `logoBlobPath`, `logoUrl` |
| `tenant_snapshots`    | Time-series of each tenant's feature config                      |
| `go_live_events`      | Detected feature/module/integration activations                  |
| `usage_metrics`       | Daily per-tenant usage including `agentRunsByName` map           |
| `linear_issues`       | Synced Linear issues                                             |
| `issue_transitions`   | Every Linear state change (for future bottleneck analysis)       |
| `projects`            | Linear projects                                                  |
| `project_scores`      | Daily project momentum scores                                    |
| `project_mappings`    | Maps Linear projects → askLio features + tenants                 |
| `pull_requests`       | GitHub PRs with full lifecycle timestamps                        |
| `commits`             | GitHub commits                                                   |
| `reviews`             | PR reviews                                                       |
| `engineers`           | Synced from GitHub + Linear (used internally for FK linkage)     |
| `sync_metadata`       | Last-sync timestamps for each pipeline                           |

## Project Mappings

To get **adoption** and **user traction** scoring for a Linear project,
insert a document into `project_mappings`:

```js
{
  linearProjectId: "<linear-project-uuid>",
  projectName: "Sourcing Agent v2",
  featureFlags: ["sourcing_agent", "sourcing_agent_negotiation"],
  integrations: ["sap"],
  tenantIds: ["schaeffler-production", "covestro-production"],
  notes: "Track adoption across enterprise customers"
}
```

## Tech stack

- **Next.js 16** + **React 19** (App Router, RSC, `revalidate = 300`)
- **Tailwind v4** + **shadcn/ui** (dark by default)
- **MongoDB** (official Node driver) — dual-cluster supported via `MONGODB_URI`
  (R/W) and `MONGODB_PROD` (R/O)
- **@linear/sdk** with a hand-rolled GraphQL query that inlines all related
  fields (avoids the SDK's N+1 lazy-loading; one request per page of 50 issues)
- **GitHub REST API** for PRs, commits, reviews, timeline events
- **@azure/storage-blob** for generating short-lived SAS URLs to tenant logos
- Deployed on **Vercel** with cron jobs declared in `vercel.json`
