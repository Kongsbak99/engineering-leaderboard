import type { Db } from "mongodb";
import type {
  Engineer,
  Commit,
  PullRequest,
  Review,
  LinearIssue,
  IssueTransition,
  Project,
  Tenant,
  TenantSnapshot,
  GoLiveEvent,
  UsageMetric,
  ProjectScore,
  SyncMetadata,
  ProjectMapping,
} from "./types";

export const COLLECTIONS = {
  engineers: "engineers",
  commits: "commits",
  pullRequests: "pull_requests",
  reviews: "reviews",
  linearIssues: "linear_issues",
  issueTransitions: "issue_transitions",
  projects: "projects",
  tenants: "tenants",
  tenantSnapshots: "tenant_snapshots",
  goLiveEvents: "go_live_events",
  usageMetrics: "usage_metrics",
  projectScores: "project_scores",
  syncMetadata: "sync_metadata",
  projectMappings: "project_mappings",
} as const;

export function engineersCol(db: Db) {
  return db.collection<Engineer>(COLLECTIONS.engineers);
}
export function commitsCol(db: Db) {
  return db.collection<Commit>(COLLECTIONS.commits);
}
export function pullRequestsCol(db: Db) {
  return db.collection<PullRequest>(COLLECTIONS.pullRequests);
}
export function reviewsCol(db: Db) {
  return db.collection<Review>(COLLECTIONS.reviews);
}
export function linearIssuesCol(db: Db) {
  return db.collection<LinearIssue>(COLLECTIONS.linearIssues);
}
export function issueTransitionsCol(db: Db) {
  return db.collection<IssueTransition>(COLLECTIONS.issueTransitions);
}
export function projectsCol(db: Db) {
  return db.collection<Project>(COLLECTIONS.projects);
}
export function tenantsCol(db: Db) {
  return db.collection<Tenant>(COLLECTIONS.tenants);
}
export function tenantSnapshotsCol(db: Db) {
  return db.collection<TenantSnapshot>(COLLECTIONS.tenantSnapshots);
}
export function goLiveEventsCol(db: Db) {
  return db.collection<GoLiveEvent>(COLLECTIONS.goLiveEvents);
}
export function usageMetricsCol(db: Db) {
  return db.collection<UsageMetric>(COLLECTIONS.usageMetrics);
}
export function projectScoresCol(db: Db) {
  return db.collection<ProjectScore>(COLLECTIONS.projectScores);
}
export function syncMetadataCol(db: Db) {
  return db.collection<SyncMetadata>(COLLECTIONS.syncMetadata);
}
export function projectMappingsCol(db: Db) {
  return db.collection<ProjectMapping>(COLLECTIONS.projectMappings);
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    engineersCol(db).createIndex({ githubUsername: 1 }, { unique: true }),
    engineersCol(db).createIndex({ linearId: 1 }, { sparse: true }),

    commitsCol(db).createIndex({ sha: 1 }, { unique: true }),
    commitsCol(db).createIndex({ engineerId: 1, committedAt: -1 }),
    commitsCol(db).createIndex({ committedAt: -1 }),

    pullRequestsCol(db).createIndex({ repo: 1, prNumber: 1 }, { unique: true }),
    pullRequestsCol(db).createIndex({ engineerId: 1, mergedAt: -1 }),
    pullRequestsCol(db).createIndex({ state: 1 }),
    pullRequestsCol(db).createIndex({ createdAt: -1 }),
    pullRequestsCol(db).createIndex({ headRef: 1 }, { sparse: true }),

    reviewsCol(db).createIndex(
      { reviewerId: 1, prId: 1, submittedAt: 1 },
      { unique: true }
    ),
    reviewsCol(db).createIndex({ reviewerId: 1, submittedAt: -1 }),
    reviewsCol(db).createIndex({ prId: 1 }),

    linearIssuesCol(db).createIndex({ linearIssueId: 1 }, { unique: true }),
    linearIssuesCol(db).createIndex({ identifier: 1 }),
    linearIssuesCol(db).createIndex({ engineerId: 1, completedAt: -1 }),
    linearIssuesCol(db).createIndex({ projectId: 1 }),
    linearIssuesCol(db).createIndex({ state: 1 }),

    issueTransitionsCol(db).createIndex({
      linearIssueId: 1,
      timestamp: 1,
    }),
    issueTransitionsCol(db).createIndex({ timestamp: -1 }),
    issueTransitionsCol(db).createIndex({ toState: 1, timestamp: -1 }),

    projectsCol(db).createIndex({ linearProjectId: 1 }, { unique: true }),

    tenantsCol(db).createIndex({ tenantId: 1 }, { unique: true }),

    tenantSnapshotsCol(db).createIndex({ tenantId: 1, snapshotAt: -1 }),

    goLiveEventsCol(db).createIndex({ detectedAt: -1 }),
    goLiveEventsCol(db).createIndex({ tenantId: 1, detectedAt: -1 }),
    goLiveEventsCol(db).createIndex({ category: 1, detectedAt: -1 }),

    usageMetricsCol(db).createIndex({ tenantId: 1, date: -1 }),
    usageMetricsCol(db).createIndex({ date: -1 }),

    projectScoresCol(db).createIndex(
      { linearProjectId: 1, date: -1 },
      { unique: true }
    ),
    projectScoresCol(db).createIndex({ date: -1 }),

    syncMetadataCol(db).createIndex({ key: 1 }, { unique: true }),

    projectMappingsCol(db).createIndex(
      { linearProjectId: 1 },
      { unique: true }
    ),
  ]);
}
