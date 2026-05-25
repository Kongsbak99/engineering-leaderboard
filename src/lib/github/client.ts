const GITHUB_API = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  } as const;
}

export async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} for ${path}: ${body}`);
  }
  return res.json();
}

export async function githubFetchAll<T>(
  path: string,
  maxPages = 10
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  const separator = path.includes("?") ? "&" : "?";

  while (page <= maxPages) {
    const url = `${GITHUB_API}${path}${separator}per_page=100&page=${page}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) break;

    const data: T[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    all.push(...data);
    page++;
  }
  return all;
}

export interface GHRepo {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export interface GHCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  stats?: { additions: number; deletions: number };
}

export interface GHPullRequest {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  head: { ref: string };
  base: { repo: { full_name: string } };
}

export interface GHReview {
  id: number;
  user: { login: string };
  state: string;
  submitted_at: string;
}

export interface GHTimelineEvent {
  event: string;
  created_at: string;
  actor?: { login: string };
}

export async function listOrgRepos(): Promise<GHRepo[]> {
  const org = process.env.GITHUB_ORG;
  if (!org) throw new Error("GITHUB_ORG not set");
  return githubFetchAll<GHRepo>(`/orgs/${org}/repos?sort=pushed&direction=desc`);
}

export async function getRepo(fullName: string): Promise<GHRepo> {
  return githubFetch<GHRepo>(`/repos/${fullName}`);
}

/**
 * Returns the repos to sync. If GITHUB_REPOS is set (comma-separated repo
 * names within GITHUB_ORG), only those are returned. Otherwise falls back to
 * listing the org's repos.
 */
export async function getReposToSync(maxOrgRepos = 20): Promise<GHRepo[]> {
  const org = process.env.GITHUB_ORG;
  if (!org) throw new Error("GITHUB_ORG not set");

  const reposEnv = process.env.GITHUB_REPOS;
  if (reposEnv) {
    const names = reposEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const repos: GHRepo[] = [];
    for (const name of names) {
      const fullName = name.includes("/") ? name : `${org}/${name}`;
      try {
        repos.push(await getRepo(fullName));
      } catch (err) {
        console.warn(
          `Could not fetch repo '${fullName}': ${err instanceof Error ? err.message : err}`
        );
      }
    }
    return repos;
  }

  const all = await listOrgRepos();
  return all.slice(0, maxOrgRepos);
}

export async function listRepoCommits(
  repo: string,
  since?: string
): Promise<GHCommit[]> {
  const sinceParam = since ? `&since=${since}` : "";
  return githubFetchAll<GHCommit>(
    `/repos/${repo}/commits?${sinceParam.slice(1)}`,
    5
  );
}

export async function getCommitDetail(
  repo: string,
  sha: string
): Promise<GHCommit> {
  return githubFetch<GHCommit>(`/repos/${repo}/commits/${sha}`);
}

export async function listRepoPRs(
  repo: string,
  state: "open" | "closed" | "all" = "all",
  since?: string
): Promise<GHPullRequest[]> {
  const sinceParam = since ? `&since=${since}` : "";
  return githubFetchAll<GHPullRequest>(
    `/repos/${repo}/pulls?state=${state}&sort=updated&direction=desc${sinceParam}`,
    3
  );
}

export async function getPRDetail(
  repo: string,
  prNumber: number
): Promise<GHPullRequest> {
  return githubFetch<GHPullRequest>(`/repos/${repo}/pulls/${prNumber}`);
}

export async function listPRReviews(
  repo: string,
  prNumber: number
): Promise<GHReview[]> {
  return githubFetch<GHReview[]>(`/repos/${repo}/pulls/${prNumber}/reviews`);
}

export async function listPRTimeline(
  repo: string,
  prNumber: number
): Promise<GHTimelineEvent[]> {
  return githubFetch<GHTimelineEvent[]>(
    `/repos/${repo}/issues/${prNumber}/timeline`
  );
}
