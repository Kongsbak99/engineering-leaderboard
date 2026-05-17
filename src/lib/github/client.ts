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
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function githubFetchAll<T>(path: string, maxPages = 10): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  const separator = path.includes("?") ? "&" : "?";

  while (page <= maxPages) {
    const url = `${GITHUB_API}${path}${separator}per_page=100&page=${page}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) break;

    const data: T[] = await res.json();
    if (data.length === 0) break;

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
  base: { repo: { full_name: string } };
}

export interface GHReview {
  id: number;
  user: { login: string };
  state: string;
  submitted_at: string;
}

export async function listOrgRepos(): Promise<GHRepo[]> {
  const org = process.env.GITHUB_ORG;
  if (!org) throw new Error("GITHUB_ORG not set");
  return githubFetchAll<GHRepo>(`/orgs/${org}/repos?sort=pushed&direction=desc`);
}

export async function listRepoCommits(
  repo: string,
  since?: string
): Promise<GHCommit[]> {
  const sinceParam = since ? `&since=${since}` : "";
  return githubFetchAll<GHCommit>(
    `/repos/${repo}/commits?per_page=100${sinceParam}`,
    5
  );
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

export async function listPRReviews(
  repo: string,
  prNumber: number
): Promise<GHReview[]> {
  return githubFetch<GHReview[]>(`/repos/${repo}/pulls/${prNumber}/reviews`);
}
