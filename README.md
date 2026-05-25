# askLio · Internal Pulse

A single-page, dark-themed dashboard for the office TV. Combines **Linear**,
**GitHub**, the **askLio production MongoDB**, and **Azure Blob Storage** (for
tenant logos) into three stacked sections:

1. **KPI strip** with rolling 7-day vs prior 7-day deltas (cycle time, PRs
   merged, average daily active users, new go-lives)
2. **Rolling go-live banner** showing recent tenant module activations with
   company logos
3. **Three tables side-by-side** — Project Momentum, Customer Usage, Agent
   Usage

By design there are **no person-scoped views** — the dashboard surfaces only
team-, project-, and customer-level signals.

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
