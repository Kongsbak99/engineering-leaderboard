import { getDashboardDb } from "@/lib/mongodb/client";
import {
  linearIssuesCol,
  issueTransitionsCol,
  pullRequestsCol,
} from "@/lib/mongodb/collections";
import {
  getLastSync,
  getOrCreateEngineerByLinear,
  getOrCreateProject,
  updateLastSync,
} from "@/lib/mongodb/helpers";
import { getLinearClient } from "./client";

const MAX_ISSUES_PER_RUN = 2000;
const PAGE_SIZE = 50;

type StateNode = { id: string; name: string; type: string } | null;

interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  estimate: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  branchName: string | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  project: {
    id: string;
    name: string;
    description: string | null;
    state: string | null;
  } | null;
  team: { id: string; key: string } | null;
  state: StateNode;
  history: {
    nodes: {
      id: string;
      createdAt: string;
      fromState: StateNode;
      toState: StateNode;
    }[];
  };
}

interface IssuesResponse {
  issues: {
    nodes: RawIssue[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

const ISSUES_QUERY = /* GraphQL */ `
  query DashboardIssues(
    $first: Int!
    $after: String
    $filter: IssueFilter
    $orderBy: PaginationOrderBy
  ) {
    issues(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
      nodes {
        id
        identifier
        title
        priority
        estimate
        createdAt
        startedAt
        completedAt
        canceledAt
        branchName
        assignee {
          id
          name
          avatarUrl
        }
        project {
          id
          name
          description
          state
        }
        team {
          id
          key
        }
        state {
          id
          name
          type
        }
        history(first: 100) {
          nodes {
            id
            createdAt
            fromState {
              id
              name
              type
            }
            toState {
              id
              name
              type
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchIssuesPage(
  linear: ReturnType<typeof getLinearClient>,
  variables: {
    first: number;
    after: string | null;
    filter: Record<string, unknown>;
    orderBy: string;
  },
  maxRetries = 5
): Promise<IssuesResponse> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await linear.client.rawRequest<
        IssuesResponse,
        typeof variables
      >(ISSUES_QUERY, variables);
      if (!response.data) {
        throw new Error("Linear returned no data for issues query");
      }
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        message.toLowerCase().includes("rate limit") ||
        message.includes("429");
      if (!isRateLimit || attempt === maxRetries - 1) throw err;
      const waitMs = Math.min(60000 * (attempt + 1), 5 * 60 * 1000);
      console.warn(
        `Linear rate limited, sleeping ${waitMs / 1000}s before retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error("Linear retries exhausted");
}

export async function syncLinear() {
  const db = await getDashboardDb();
  const linear = getLinearClient();
  const lastSync = await getLastSync(db, "linear");

  let totalIssues = 0;
  let totalProjects = 0;
  let totalTransitions = 0;

  const projectsConnection = await linear.projects({
    first: 50,
    orderBy: "updatedAt" as never,
  });

  for (const project of projectsConnection.nodes) {
    await getOrCreateProject(
      db,
      project.id,
      project.name,
      project.description ?? undefined,
      project.state ?? undefined
    );
    totalProjects++;
  }

  const filter: Record<string, unknown> = {};
  if (lastSync) {
    filter.updatedAt = { gte: lastSync.toISOString() };
  }

  let hasMore = true;
  let afterCursor: string | null = null;
  let pageIndex = 0;

  while (hasMore && totalIssues < MAX_ISSUES_PER_RUN) {
    const page = await fetchIssuesPage(linear, {
      first: PAGE_SIZE,
      after: afterCursor,
      filter,
      orderBy: "updatedAt",
    });

    pageIndex++;
    console.log(
      `[linear] page ${pageIndex}: ${page.issues.nodes.length} issues`
    );

    for (const issue of page.issues.nodes) {
      let engineerId: string | null = null;
      if (issue.assignee) {
        engineerId = await getOrCreateEngineerByLinear(
          db,
          issue.assignee.id,
          issue.assignee.name,
          issue.assignee.avatarUrl ?? undefined
        );
      }

      let projectId: string | null = null;
      if (issue.project) {
        projectId = await getOrCreateProject(
          db,
          issue.project.id,
          issue.project.name,
          issue.project.description ?? undefined,
          issue.project.state ?? undefined
        );
      }

      const stateName = issue.state?.name ?? "Unknown";
      const stateType = issue.state?.type ?? null;

      const startedAt = issue.startedAt ? new Date(issue.startedAt) : null;
      const completedAt = issue.completedAt ? new Date(issue.completedAt) : null;
      const canceledAt = issue.canceledAt ? new Date(issue.canceledAt) : null;

      let cycleTimeHours: number | null = null;
      if (startedAt && completedAt) {
        cycleTimeHours =
          (completedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      }

      const existing = await linearIssuesCol(db).findOne({
        linearIssueId: issue.id,
      });

      await linearIssuesCol(db).updateOne(
        { linearIssueId: issue.id },
        {
          $set: {
            linearIssueId: issue.id,
            identifier: issue.identifier,
            title: issue.title.slice(0, 500),
            engineerId,
            projectId,
            teamId: issue.team?.id ?? null,
            teamKey: issue.team?.key ?? null,
            priority: issue.priority,
            state: stateName,
            stateType,
            estimate: issue.estimate ?? null,
            createdAt: new Date(issue.createdAt),
            startedAt,
            completedAt,
            canceledAt,
            cycleTimeHours,
            branchName: issue.branchName ?? null,
          },
          $setOnInsert: { linkedPrIds: existing?.linkedPrIds ?? [] },
        },
        { upsert: true }
      );
      totalIssues++;

      const stateChanges = issue.history.nodes
        .filter((h) => h.toState)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

      let prevTimestamp = new Date(issue.createdAt);

      for (const entry of stateChanges) {
        if (!entry.toState) continue;
        const timestamp = new Date(entry.createdAt);
        const durationHours =
          (timestamp.getTime() - prevTimestamp.getTime()) / (1000 * 60 * 60);

        await issueTransitionsCol(db).updateOne(
          {
            linearIssueId: issue.id,
            timestamp,
            toState: entry.toState.name,
          },
          {
            $set: {
              linearIssueId: issue.id,
              identifier: issue.identifier,
              fromState: entry.fromState?.name ?? null,
              fromStateType: entry.fromState?.type ?? null,
              toState: entry.toState.name,
              toStateType: entry.toState.type ?? null,
              timestamp,
              engineerId,
              durationFromPreviousHours: durationHours,
            },
          },
          { upsert: true }
        );
        totalTransitions++;
        prevTimestamp = timestamp;
      }

      if (issue.branchName) {
        const matched = await pullRequestsCol(db)
          .find({ headRef: issue.branchName })
          .toArray();
        if (matched.length > 0) {
          const prIds = matched.map((p) => p._id!.toString());
          await linearIssuesCol(db).updateOne(
            { linearIssueId: issue.id },
            { $addToSet: { linkedPrIds: { $each: prIds } } }
          );
          for (const pr of matched) {
            await pullRequestsCol(db).updateOne(
              { _id: pr._id! },
              { $addToSet: { linkedLinearIssueIds: issue.id } }
            );
          }
        }
      }
    }

    hasMore = page.issues.pageInfo.hasNextPage;
    afterCursor = page.issues.pageInfo.endCursor;
  }

  await updateLastSync(db, "linear");

  return { totalIssues, totalProjects, totalTransitions };
}
