import type { ObjectId } from "mongodb";

export interface Engineer {
  _id?: ObjectId;
  githubUsername: string;
  linearId?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  team?: string | null;
  createdAt: Date;
}

export interface Commit {
  _id?: ObjectId;
  sha: string;
  repo: string;
  engineerId: string;
  message: string;
  linesAdded: number;
  linesRemoved: number;
  committedAt: Date;
}

export interface PullRequest {
  _id?: ObjectId;
  repo: string;
  prNumber: number;
  engineerId: string;
  title: string;
  state: "open" | "closed" | "merged";
  createdAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewRequestedAt: Date | null;
  firstReviewAt: Date | null;
  approvedAt: Date | null;
  headRef: string | null;
  linkedLinearIssueIds: string[];
}

export interface Review {
  _id?: ObjectId;
  reviewerId: string;
  prId: string;
  repo: string;
  prNumber: number;
  submittedAt: Date;
  state: "approved" | "changes_requested" | "commented" | "dismissed";
}

export interface LinearIssue {
  _id?: ObjectId;
  linearIssueId: string;
  identifier: string;
  title: string;
  engineerId: string | null;
  projectId: string | null;
  teamId: string | null;
  teamKey: string | null;
  priority: number;
  state: string;
  stateType: string | null;
  estimate: number | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  cycleTimeHours: number | null;
  branchName: string | null;
  linkedPrIds: string[];
}

export interface IssueTransition {
  _id?: ObjectId;
  linearIssueId: string;
  identifier: string;
  fromState: string | null;
  fromStateType: string | null;
  toState: string;
  toStateType: string | null;
  timestamp: Date;
  engineerId: string | null;
  durationFromPreviousHours: number | null;
}

export interface Project {
  _id?: ObjectId;
  linearProjectId: string;
  name: string;
  description?: string | null;
  state: string | null;
  status: "active" | "completed" | "archived";
  startedAt: Date | null;
  targetDate: Date | null;
  createdAt: Date;
}

export interface TenantSnapshot {
  _id?: ObjectId;
  tenantId: string;
  snapshotAt: Date;
  featureFlags: Record<string, boolean | Record<string, boolean>>;
  integrations: Record<string, boolean | Record<string, unknown>>;
  features: Record<string, unknown>;
  activeUserCount: number;
  pendingUserCount: number;
  organisationCount: number;
  publishedAgentConfigCount: number;
}

export type GoLiveCategory =
  | "feature_flag"
  | "integration"
  | "agent_config"
  | "tenant_created"
  | "user_growth";

export interface GoLiveEvent {
  _id?: ObjectId;
  tenantId: string;
  tenantName: string;
  category: GoLiveCategory;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  detectedAt: Date;
  description: string;
}

export interface UsageMetric {
  _id?: ObjectId;
  tenantId: string;
  date: string;
  conversations: number;
  purchaseRequests: number;
  itemSearches: number;
  activeUsers: number;
  agentRuns: number;
  agentRunsByName: Record<string, number>;
  feedbackPositive: number;
  feedbackNegative: number;
  totalSpend: number;
  capturedAt: Date;
}

export interface Tenant {
  _id?: ObjectId;
  tenantId: string;
  displayName: string;
  logoBlobPath: string | null;
  logoUrl: string | null;
  logoUpdatedAt: Date | null;
  domain: string | null;
  createdAt: Date;
}

export interface ProjectMomentumComponents {
  ticketVelocity: number;
  ticketThroughput: number;
  cycleTimeEfficiency: number;
  codeVolume: number;
  prThroughput: number;
  adoption: number;
  userTraction: number;
}

export interface ProjectScore {
  _id?: ObjectId;
  linearProjectId: string;
  date: string;
  momentumScore: number;
  trend: number;
  components: ProjectMomentumComponents;
  ticketsCompleted: number;
  ticketsCreated: number;
  blockedCount: number;
  prsMerged: number;
  linesChanged: number;
  goLiveCount: number;
  capturedAt: Date;
}

export interface SyncMetadata {
  _id?: ObjectId;
  key: string;
  lastSyncedAt: Date;
}

export interface ProjectMapping {
  _id?: ObjectId;
  linearProjectId: string;
  projectName: string;
  featureFlags: string[];
  integrations: string[];
  usageCollections: string[];
  tenantIds: string[];
  notes?: string;
}

export type KpiDirection = "up" | "down" | "flat";

export interface KpiWithDelta {
  key: "activeUsers" | "goLives" | "purchaseRequests" | "agentRuns";
  label: string;
  unit: string;
  value: number;
  previousValue: number;
  delta: number;
  deltaPct: number;
  direction: KpiDirection;
  goodDirection: "up" | "down";
}

/**
 * Trend over the last 7 days vs the previous 7 days.
 *
 * - `pct` is a percent change, rounded; null when the previous window is empty
 *   AND `isNew` is true (avoids "+Infinity%" noise).
 * - `isNew` is true when the row has activity this week but none last week.
 */
export interface Trend {
  pct: number | null;
  isNew: boolean;
}

export interface ProjectMomentumRow {
  linearProjectId: string;
  name: string;
  momentumScore: number;
  trend: Trend;
}

export interface CustomerUsageRow {
  tenantId: string;
  displayName: string;
  logoUrl: string | null;
  activeUsers: number;
  totalSpend: number;
  purchaseRequests: number;
  conversations: number;
  trend: Trend;
}

export interface AgentUsageRow {
  agentName: string;
  tenantId: string;
  displayName: string;
  logoUrl: string | null;
  runs: number;
  trend: Trend;
}

export interface GoLiveFeed {
  id: string;
  tenantId: string;
  tenantName: string;
  logoUrl: string | null;
  category: GoLiveCategory;
  field: string;
  description: string;
  detectedAt: Date;
}
