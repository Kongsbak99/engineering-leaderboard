import type {
  EngineerWithScores,
  ProjectWithMetrics,
  HealthMetrics,
} from "@/lib/supabase/types";

const AVATARS = [
  "https://api.dicebear.com/9.x/notionists/svg?seed=Alice",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Bob",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Charlie",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Dana",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Eve",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Frank",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Grace",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Hank",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Ivy",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Jack",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Kara",
  "https://api.dicebear.com/9.x/notionists/svg?seed=Leo",
];

const TEAMS = ["Platform", "Frontend", "Backend", "Infrastructure", "Data", "Mobile"];

function engineer(
  i: number,
  name: string,
  team: string,
  delivery: number,
  collab: number,
  extras: Partial<EngineerWithScores> = {}
): EngineerWithScores {
  return {
    id: `eng-${i}`,
    github_username: name.toLowerCase().replace(/\s/g, ""),
    linear_id: `lin-${i}`,
    display_name: name,
    avatar_url: AVATARS[i % AVATARS.length],
    team,
    created_at: "2024-01-01T00:00:00Z",
    delivery_score: delivery,
    collaboration_score: collab,
    prs_merged: Math.floor(Math.random() * 15) + 3,
    reviews_given: Math.floor(Math.random() * 20) + 2,
    avg_cycle_time_hours: Math.random() * 72 + 8,
    commits_count: Math.floor(Math.random() * 40) + 5,
    ...extras,
  };
}

export const mockEngineers: EngineerWithScores[] = [
  engineer(0, "Alice Chen", "Platform", 94, 72, { prs_merged: 14, avg_cycle_time_hours: 12 }),
  engineer(1, "Bob Martinez", "Backend", 87, 65, { prs_merged: 11, avg_cycle_time_hours: 18 }),
  engineer(2, "Charlie Kim", "Frontend", 79, 88, { prs_merged: 8, avg_cycle_time_hours: 24 }),
  engineer(3, "Dana Osei", "Infrastructure", 75, 91, { prs_merged: 6, reviews_given: 22 }),
  engineer(4, "Eve Johansson", "Backend", 82, 78, { prs_merged: 10, avg_cycle_time_hours: 16 }),
  engineer(5, "Frank Russo", "Platform", 71, 84, { prs_merged: 7, reviews_given: 19 }),
  engineer(6, "Grace Liu", "Data", 88, 62, { prs_merged: 12, avg_cycle_time_hours: 14 }),
  engineer(7, "Hank Petrov", "Mobile", 66, 73, { prs_merged: 5, avg_cycle_time_hours: 32 }),
  engineer(8, "Ivy Nakamura", "Frontend", 73, 80, { prs_merged: 9, reviews_given: 17 }),
  engineer(9, "Jack Andersen", "Infrastructure", 69, 86, { prs_merged: 4, reviews_given: 21 }),
  engineer(10, "Kara Singh", "Backend", 85, 70, { prs_merged: 13, avg_cycle_time_hours: 15 }),
  engineer(11, "Leo Fernandez", "Data", 77, 67, { prs_merged: 8, avg_cycle_time_hours: 22 }),
];

export const mockDeliveryLeaders = [...mockEngineers]
  .sort((a, b) => b.delivery_score - a.delivery_score);

export const mockCollabLeaders = [...mockEngineers]
  .sort((a, b) => b.collaboration_score - a.collaboration_score);

export const mockProjects: ProjectWithMetrics[] = [
  {
    id: "proj-1",
    linear_project_id: "lp-1",
    name: "Enterprise SSO",
    description: "Single sign-on for enterprise clients",
    status: "active",
    ticket_count: 42,
    completed_count: 38,
    avg_cycle_time_hours: 28,
    velocity_score: 92,
    blocked_count: 0,
    completion_pct: 90,
  },
  {
    id: "proj-2",
    linear_project_id: "lp-2",
    name: "Platform v3 Migration",
    description: "Core platform upgrade to v3 architecture",
    status: "active",
    ticket_count: 87,
    completed_count: 61,
    avg_cycle_time_hours: 48,
    velocity_score: 78,
    blocked_count: 3,
    completion_pct: 70,
  },
  {
    id: "proj-3",
    linear_project_id: "lp-3",
    name: "Analytics Dashboard",
    description: "Customer-facing analytics and reporting",
    status: "active",
    ticket_count: 35,
    completed_count: 28,
    avg_cycle_time_hours: 18,
    velocity_score: 85,
    blocked_count: 1,
    completion_pct: 80,
  },
  {
    id: "proj-4",
    linear_project_id: "lp-4",
    name: "Mobile App Refresh",
    description: "Complete mobile app redesign",
    status: "active",
    ticket_count: 64,
    completed_count: 22,
    avg_cycle_time_hours: 56,
    velocity_score: 61,
    blocked_count: 5,
    completion_pct: 34,
  },
  {
    id: "proj-5",
    linear_project_id: "lp-5",
    name: "API Gateway",
    description: "Centralized API gateway and rate limiting",
    status: "active",
    ticket_count: 28,
    completed_count: 12,
    avg_cycle_time_hours: 36,
    velocity_score: 45,
    blocked_count: 2,
    completion_pct: 43,
  },
  {
    id: "proj-6",
    linear_project_id: "lp-6",
    name: "CI/CD Pipeline",
    description: "Build and deployment automation",
    status: "active",
    ticket_count: 19,
    completed_count: 16,
    avg_cycle_time_hours: 14,
    velocity_score: 88,
    blocked_count: 0,
    completion_pct: 84,
  },
];

export const mockHealthMetrics: HealthMetrics = {
  deploys_this_week: 47,
  avg_cycle_time_days: 2.1,
  open_prs: 13,
  change_failure_rate: 3.2,
};
