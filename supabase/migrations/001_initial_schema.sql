-- Engineers table: maps GitHub + Linear identities
create table if not exists engineers (
  id uuid primary key default gen_random_uuid(),
  github_username text unique not null,
  linear_id text unique,
  display_name text not null,
  avatar_url text,
  team text,
  created_at timestamptz default now()
);

-- Git commits
create table if not exists commits (
  id uuid primary key default gen_random_uuid(),
  engineer_id uuid references engineers(id) on delete cascade,
  repo text not null,
  sha text unique not null,
  message text,
  lines_added integer default 0,
  lines_removed integer default 0,
  committed_at timestamptz not null
);

create index idx_commits_engineer on commits(engineer_id);
create index idx_commits_date on commits(committed_at);

-- Pull requests
create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  engineer_id uuid references engineers(id) on delete cascade,
  repo text not null,
  pr_number integer not null,
  title text,
  state text not null default 'open',
  created_at timestamptz not null,
  merged_at timestamptz,
  review_turnaround_hours real,
  unique(repo, pr_number)
);

create index idx_prs_engineer on pull_requests(engineer_id);
create index idx_prs_state on pull_requests(state);
create index idx_prs_merged on pull_requests(merged_at);

-- PR reviews
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references engineers(id) on delete cascade,
  pr_id uuid references pull_requests(id) on delete cascade,
  submitted_at timestamptz not null,
  state text not null
);

create index idx_reviews_reviewer on reviews(reviewer_id);

-- Linear projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  linear_project_id text unique not null,
  name text not null,
  description text,
  status text default 'active'
);

-- Linear issues
create table if not exists linear_issues (
  id uuid primary key default gen_random_uuid(),
  linear_issue_id text unique not null,
  engineer_id uuid references engineers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  identifier text not null,
  title text not null,
  priority integer default 0,
  state text not null,
  created_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  cycle_time_hours real
);

create index idx_issues_engineer on linear_issues(engineer_id);
create index idx_issues_project on linear_issues(project_id);
create index idx_issues_state on linear_issues(state);

-- Daily snapshot for fast dashboard reads
create table if not exists daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  engineer_id uuid references engineers(id) on delete cascade,
  delivery_score real default 0,
  collaboration_score real default 0,
  prs_merged integer default 0,
  reviews_given integer default 0,
  avg_cycle_time_hours real,
  avg_review_turnaround_hours real,
  commits_count integer default 0,
  lines_added integer default 0,
  lines_removed integer default 0,
  unique(date, engineer_id)
);

create index idx_snapshots_date on daily_snapshots(date);
create index idx_snapshots_engineer on daily_snapshots(engineer_id);

-- Sync metadata to track last sync timestamps
create table if not exists sync_metadata (
  id text primary key,
  last_synced_at timestamptz not null default now(),
  cursor_value text,
  extra jsonb
);
