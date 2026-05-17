import { getServiceClient } from "@/lib/supabase/client";
import {
  listOrgRepos,
  listRepoCommits,
  listRepoPRs,
  listPRReviews,
} from "./client";

async function getOrCreateEngineer(
  supabase: ReturnType<typeof getServiceClient>,
  githubUsername: string,
  avatarUrl?: string
) {
  const { data: existing } = await supabase
    .from("engineers")
    .select("id")
    .eq("github_username", githubUsername)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("engineers")
    .upsert(
      {
        github_username: githubUsername,
        display_name: githubUsername,
        avatar_url: avatarUrl ?? null,
      },
      { onConflict: "github_username" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return created!.id;
}

async function getLastSync(
  supabase: ReturnType<typeof getServiceClient>,
  key: string
): Promise<string | null> {
  const { data } = await supabase
    .from("sync_metadata")
    .select("last_synced_at")
    .eq("id", key)
    .single();
  return data?.last_synced_at ?? null;
}

async function updateLastSync(
  supabase: ReturnType<typeof getServiceClient>,
  key: string
) {
  await supabase.from("sync_metadata").upsert({
    id: key,
    last_synced_at: new Date().toISOString(),
  });
}

export async function syncGitHub() {
  const supabase = getServiceClient();
  const lastSync = await getLastSync(supabase, "github");
  const repos = await listOrgRepos();

  let totalCommits = 0;
  let totalPRs = 0;
  let totalReviews = 0;

  for (const repo of repos.slice(0, 20)) {
    // Sync commits
    const commits = await listRepoCommits(
      repo.full_name,
      lastSync ?? undefined
    );
    for (const commit of commits) {
      if (!commit.author?.login) continue;

      const engineerId = await getOrCreateEngineer(
        supabase,
        commit.author.login,
        commit.author.avatar_url
      );

      await supabase.from("commits").upsert(
        {
          engineer_id: engineerId,
          repo: repo.full_name,
          sha: commit.sha,
          message: commit.commit.message.slice(0, 500),
          lines_added: commit.stats?.additions ?? 0,
          lines_removed: commit.stats?.deletions ?? 0,
          committed_at: commit.commit.author.date,
        },
        { onConflict: "sha" }
      );
      totalCommits++;
    }

    // Sync PRs
    const prs = await listRepoPRs(repo.full_name, "all", lastSync ?? undefined);
    for (const pr of prs) {
      const engineerId = await getOrCreateEngineer(
        supabase,
        pr.user.login,
        pr.user.avatar_url
      );

      const prState =
        pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open";

      const { data: upserted } = await supabase
        .from("pull_requests")
        .upsert(
          {
            engineer_id: engineerId,
            repo: repo.full_name,
            pr_number: pr.number,
            title: pr.title.slice(0, 500),
            state: prState,
            created_at: pr.created_at,
            merged_at: pr.merged_at,
          },
          { onConflict: "repo,pr_number" }
        )
        .select("id")
        .single();

      totalPRs++;

      // Sync reviews for this PR
      if (upserted) {
        try {
          const reviews = await listPRReviews(repo.full_name, pr.number);
          for (const review of reviews) {
            const reviewerId = await getOrCreateEngineer(
              supabase,
              review.user.login
            );

            await supabase.from("reviews").upsert(
              {
                reviewer_id: reviewerId,
                pr_id: upserted.id,
                submitted_at: review.submitted_at,
                state: review.state.toLowerCase(),
              },
              { onConflict: "reviewer_id,pr_id,submitted_at" }
            );
            totalReviews++;
          }
        } catch {
          // Reviews endpoint can 404 for some PRs
        }
      }
    }
  }

  await updateLastSync(supabase, "github");

  return { totalCommits, totalPRs, totalReviews, reposProcessed: Math.min(repos.length, 20) };
}
