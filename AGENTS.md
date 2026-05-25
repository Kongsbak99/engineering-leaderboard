# askLio Internal Pulse - Agent Guide

## What this app does

A single-page, dark-themed, **TV-mode** internal dashboard combining
**Linear**, **GitHub**, the **askLio production MongoDB**, and **Azure Blob
Storage** (for tenant logos) into three stacked sections:

1. **KPI strip** (top) — 4 topline numbers with rolling 7-day vs prior 7-day deltas:
   avg cycle time, PRs merged, average daily active users, new go-lives.
2. **Go-live marquee** (middle) — continuously scrolling banner of recent
   tenant module activations with company logos.
3. **Three tables** (bottom) — Project Momentum, Customer Usage, Agent Usage,
   side-by-side.

There are **no person-scoped views** by design — the dashboard intentionally
does not surface individual engineer metrics, to avoid optimizing for proxy
incentives (small PRs, easy tickets).

## Tech

- Next.js 16 (App Router, RSC) — single `/` route with `revalidate = 300`
- React 19, Tailwind v4, shadcn/ui
- MongoDB driver — **two optional connection strings**: `MONGODB_URI`
  (read/write, dashboard data) and `MONGODB_PROD` (read-only, askLio tenants).
  Falls back to `MONGODB_URI` for tenants if `MONGODB_PROD` is unset.
- @linear/sdk + GitHub REST API
- `@azure/storage-blob` for generating short-lived SAS URLs to tenant logos
- Vercel cron jobs in `vercel.json`

## Layout

- `src/app/page.tsx` — the one-pager (only user-facing route)
- `src/app/api/cron/*` — five cron endpoints (linear, github, tenant-snapshot, usage-sync, scores)
- `src/components/dashboard/` — `kpi-strip`, `go-live-marquee`, `momentum-table`, `customer-usage-table`, `agent-usage-table`
- `src/lib/data.ts` — all data fetching for the page; falls back to mock data when `MONGODB_URI` is unset
- `src/lib/mongodb/` — client, types, collection accessors
- `src/lib/github/`, `src/lib/linear/` — API clients + sync pipelines
- `src/lib/asklio/` — tenant discovery, snapshot polling (also captures logos), usage sync (also captures per-agent run counts)
- `src/lib/azure/blob.ts` — SAS URL generation for tenant company logos
- `src/lib/scoring/project.ts` — composite project momentum scoring (project-scoped only)
- `src/config/scoring.ts` — weights, feature flag keys, display names

## Key conventions

- **Mock data fallback**: if `MONGODB_URI` is unset, the data layer returns
  small mock fixtures so UI work needs no infrastructure.
- **Tenant discovery**: a database qualifies as a real tenant only if (a) it
  ends with `-{stage}`, (b) name doesn't contain
  `demo`/`workshop`/`backup`/`test`/`sandbox`/`qa`/`eval`/`quality`, (c) it has
  both `common` and `config` collections, (d) it's not a system DB or the
  dashboard's own. See `src/lib/asklio/tenant-discovery.ts`.
- **Tenants collection**: `tenants` is upserted by the snapshot cron with
  `{ tenantId, displayName, logoBlobPath, logoUrl, logoUpdatedAt }`. The
  `logoUrl` is a SAS URL valid for 7 days, refreshed each snapshot run.
- **Per-agent usage**: `usage_metrics.agentRunsByName` is a map
  `{ "Sourcing Agent v2": 1021, ... }` aggregated from `agent_runs.name` in
  each tenant DB.
- **WoW window**: rolling 7-day vs the previous 7 days; computed at query time
  in `getKpisWithDelta()` rather than persisted.
- **No Mongoose**: use the official driver; collection accessors live in
  `src/lib/mongodb/collections.ts`.
- **Cron auth**: routes check `Authorization: Bearer ${CRON_SECRET}` when set.
- **State transitions**: `issue_transitions` still captures every Linear state
  change for future bottleneck analysis but isn't surfaced anywhere yet.
- **PR ↔ Issue linking**: matches by branch name and `LIO-123` identifier in
  title/branch; stored in `linear_issues.linkedPrIds`.

## Build / test

```bash
npm run dev    # http://localhost:3000
npm run build  # production build
npm run lint
npx tsc --noEmit  # type-check only
```

## Data flow

```
GitHub API   → /api/cron/github          → commits, pull_requests, reviews
Linear API   → /api/cron/linear          → linear_issues, issue_transitions, projects
askLio Mongo → /api/cron/tenant-snapshot → tenant_snapshots, tenants (with logo URL), go_live_events
askLio Mongo → /api/cron/usage-sync      → usage_metrics (incl. agentRunsByName)
             → /api/cron/scores          → project_scores
```

## Things to keep in mind

- **Don't add engineer-scoped views.** The point of this dashboard is
  team-level / project-level / customer-level signals only.
- **One page, no scroll.** The layout assumes 1080p+ and uses `h-screen` with
  explicit section sizing. New widgets should fit inside the existing 3-table
  bottom row or replace one of them.
- **SAS URLs expire.** If logos disappear, run the tenant-snapshot cron — it
  regenerates them. Don't try to cache them longer than 7 days.
