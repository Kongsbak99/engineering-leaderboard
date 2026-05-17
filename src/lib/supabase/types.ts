export interface Engineer {
  id: string;
  github_username: string;
  linear_id: string | null;
  display_name: string;
  avatar_url: string | null;
  team: string | null;
  created_at: string;
}

export interface Commit {
  id: string;
  engineer_id: string;
  repo: string;
  sha: string;
  message: string;
  lines_added: number;
  lines_removed: number;
  committed_at: string;
}

export interface PullRequest {
  id: string;
  engineer_id: string;
  repo: string;
  pr_number: number;
  title: string;
  state: "open" | "closed" | "merged";
  created_at: string;
  merged_at: string | null;
  review_turnaround_hours: number | null;
}

export interface Review {
  id: string;
  reviewer_id: string;
  pr_id: string;
  submitted_at: string;
  state: "approved" | "changes_requested" | "commented";
}

export interface LinearIssue {
  id: string;
  engineer_id: string | null;
  project_id: string | null;
  identifier: string;
  title: string;
  priority: number;
  state: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cycle_time_hours: number | null;
}

export interface Project {
  id: string;
  linear_project_id: string;
  name: string;
  description: string | null;
  status: string;
}

export interface DailySnapshot {
  id: string;
  date: string;
  engineer_id: string;
  delivery_score: number;
  collaboration_score: number;
  prs_merged: number;
  reviews_given: number;
  avg_cycle_time_hours: number | null;
  avg_review_turnaround_hours: number | null;
  commits_count: number;
  lines_added: number;
  lines_removed: number;
}

export interface EngineerWithScores extends Engineer {
  delivery_score: number;
  collaboration_score: number;
  prs_merged: number;
  reviews_given: number;
  avg_cycle_time_hours: number | null;
  commits_count: number;
}

export interface ProjectWithMetrics extends Project {
  ticket_count: number;
  completed_count: number;
  avg_cycle_time_hours: number | null;
  velocity_score: number;
  blocked_count: number;
  completion_pct: number;
}

export interface HealthMetrics {
  deploys_this_week: number;
  avg_cycle_time_days: number;
  open_prs: number;
  change_failure_rate: number;
}
