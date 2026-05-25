import { getDashboardDb } from "@/lib/mongodb/client";
import {
  commitsCol,
  pullRequestsCol,
  reviewsCol,
  linearIssuesCol,
} from "@/lib/mongodb/collections";
import {
  getLastSync,
  getOrCreateEngineerByGithub,
  updateLastSync,
} from "@/lib/mongodb/helpers";
import {
  getReposToSync,
  listRepoCommits,
  listRepoPRs,
  listPRReviews,
  listPRTimeline,
} from "./client";

const LINEAR_ID_RE = /\b([A-Z]{2,}-\d+)\b/;

function extractLinearIdentifier(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.match(LINEAR_ID_RE);
  return match?.[1] ?? null;
}

export async function syncGitHub() {
  const db = await getDashboardDb();
  const lastSync = await getLastSync(db, "github");
  const lastSyncIso = lastSync?.toISOString();
  const repos = await getReposToSync();

  let totalCommits = 0;
  let totalPRs = 0;
  let totalReviews = 0;

  for (const repo of repos) {
    const commits = await listRepoCommits(repo.full_name, lastSyncIso);
    for (const commit of commits) {
      if (!commit.author?.login) continue;
      const engineerId = await getOrCreateEngineerByGithub(
        db,
        commit.author.login,
        commit.author.avatar_url
      );

      await commitsCol(db).updateOne(
        { sha: commit.sha },
        {
          $set: {
            sha: commit.sha,
            repo: repo.full_name,
            engineerId,
            message: commit.commit.message.slice(0, 500),
            linesAdded: commit.stats?.additions ?? 0,
            linesRemoved: commit.stats?.deletions ?? 0,
            committedAt: new Date(commit.commit.author.date),
          },
        },
        { upsert: true }
      );
      totalCommits++;
    }

    const prs = await listRepoPRs(repo.full_name, "all", lastSyncIso);
    for (const pr of prs) {
      const engineerId = await getOrCreateEngineerByGithub(
        db,
        pr.user.login,
        pr.user.avatar_url
      );

      const prState: "open" | "closed" | "merged" = pr.merged_at
        ? "merged"
        : pr.state === "closed"
          ? "closed"
          : "open";

      let reviewRequestedAt: Date | null = null;
      let firstReviewAt: Date | null = null;
      let approvedAt: Date | null = null;

      try {
        const timeline = await listPRTimeline(repo.full_name, pr.number);
        for (const event of timeline) {
          if (event.event === "review_requested" && !reviewRequestedAt) {
            reviewRequestedAt = new Date(event.created_at);
          }
        }
      } catch {
        // timeline can occasionally 404; ignore
      }

      try {
        const reviews = await listPRReviews(repo.full_name, pr.number);
        for (const review of reviews.sort((a, b) =>
          a.submitted_at.localeCompare(b.submitted_at)
        )) {
          if (!firstReviewAt) firstReviewAt = new Date(review.submitted_at);
          if (review.state.toLowerCase() === "approved" && !approvedAt) {
            approvedAt = new Date(review.submitted_at);
          }
        }

        const upsertResult = await pullRequestsCol(db).findOneAndUpdate(
          { repo: repo.full_name, prNumber: pr.number },
          {
            $set: {
              repo: repo.full_name,
              prNumber: pr.number,
              engineerId,
              title: pr.title.slice(0, 500),
              state: prState,
              createdAt: new Date(pr.created_at),
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
              additions: pr.additions ?? 0,
              deletions: pr.deletions ?? 0,
              changedFiles: pr.changed_files ?? 0,
              reviewRequestedAt,
              firstReviewAt,
              approvedAt,
              headRef: pr.head?.ref ?? null,
            },
            $setOnInsert: { linkedLinearIssueIds: [] },
          },
          { upsert: true, returnDocument: "after" }
        );
        totalPRs++;

        const prId = upsertResult!._id!.toString();

        const linearIdentifier =
          extractLinearIdentifier(pr.title) ??
          extractLinearIdentifier(pr.head?.ref);
        if (linearIdentifier) {
          const linkedIssue = await linearIssuesCol(db).findOne({
            identifier: linearIdentifier,
          });
          if (linkedIssue) {
            await pullRequestsCol(db).updateOne(
              { _id: upsertResult!._id! },
              { $addToSet: { linkedLinearIssueIds: linkedIssue.linearIssueId } }
            );
            await linearIssuesCol(db).updateOne(
              { linearIssueId: linkedIssue.linearIssueId },
              { $addToSet: { linkedPrIds: prId } }
            );
          }
        }

        for (const review of reviews) {
          const reviewerId = await getOrCreateEngineerByGithub(
            db,
            review.user.login
          );
          const submittedAt = new Date(review.submitted_at);

          await reviewsCol(db).updateOne(
            {
              reviewerId,
              prId,
              submittedAt,
            },
            {
              $set: {
                reviewerId,
                prId,
                repo: repo.full_name,
                prNumber: pr.number,
                submittedAt,
                state: review.state.toLowerCase() as
                  | "approved"
                  | "changes_requested"
                  | "commented"
                  | "dismissed",
              },
            },
            { upsert: true }
          );
          totalReviews++;
        }
      } catch {
        // Reviews endpoint can 404 for some PRs
      }
    }
  }

  await updateLastSync(db, "github");

  return {
    totalCommits,
    totalPRs,
    totalReviews,
    reposProcessed: repos.length,
    repos: repos.map((r) => r.full_name),
  };
}
