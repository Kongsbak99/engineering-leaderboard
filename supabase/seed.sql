-- Seed data for development / demo purposes
-- This mirrors the mock data used in the frontend

insert into engineers (id, github_username, linear_id, display_name, avatar_url, team) values
  ('00000000-0000-0000-0000-000000000001', 'alicechen', 'lin-0', 'Alice Chen', 'https://api.dicebear.com/9.x/notionists/svg?seed=Alice', 'Platform'),
  ('00000000-0000-0000-0000-000000000002', 'bobmartinez', 'lin-1', 'Bob Martinez', 'https://api.dicebear.com/9.x/notionists/svg?seed=Bob', 'Backend'),
  ('00000000-0000-0000-0000-000000000003', 'charliekim', 'lin-2', 'Charlie Kim', 'https://api.dicebear.com/9.x/notionists/svg?seed=Charlie', 'Frontend'),
  ('00000000-0000-0000-0000-000000000004', 'danaosei', 'lin-3', 'Dana Osei', 'https://api.dicebear.com/9.x/notionists/svg?seed=Dana', 'Infrastructure'),
  ('00000000-0000-0000-0000-000000000005', 'evejohansson', 'lin-4', 'Eve Johansson', 'https://api.dicebear.com/9.x/notionists/svg?seed=Eve', 'Backend'),
  ('00000000-0000-0000-0000-000000000006', 'frankrusso', 'lin-5', 'Frank Russo', 'https://api.dicebear.com/9.x/notionists/svg?seed=Frank', 'Platform'),
  ('00000000-0000-0000-0000-000000000007', 'graceliu', 'lin-6', 'Grace Liu', 'https://api.dicebear.com/9.x/notionists/svg?seed=Grace', 'Data'),
  ('00000000-0000-0000-0000-000000000008', 'hankpetrov', 'lin-7', 'Hank Petrov', 'https://api.dicebear.com/9.x/notionists/svg?seed=Hank', 'Mobile'),
  ('00000000-0000-0000-0000-000000000009', 'ivynakamura', 'lin-8', 'Ivy Nakamura', 'https://api.dicebear.com/9.x/notionists/svg?seed=Ivy', 'Frontend'),
  ('00000000-0000-0000-0000-00000000000a', 'jackandersen', 'lin-9', 'Jack Andersen', 'https://api.dicebear.com/9.x/notionists/svg?seed=Jack', 'Infrastructure'),
  ('00000000-0000-0000-0000-00000000000b', 'karasingh', 'lin-10', 'Kara Singh', 'https://api.dicebear.com/9.x/notionists/svg?seed=Kara', 'Backend'),
  ('00000000-0000-0000-0000-00000000000c', 'leofernandez', 'lin-11', 'Leo Fernandez', 'https://api.dicebear.com/9.x/notionists/svg?seed=Leo', 'Data')
on conflict (github_username) do nothing;

insert into projects (id, linear_project_id, name, description, status) values
  ('00000000-0000-0000-0001-000000000001', 'lp-1', 'Enterprise SSO', 'Single sign-on for enterprise clients', 'active'),
  ('00000000-0000-0000-0001-000000000002', 'lp-2', 'Platform v3 Migration', 'Core platform upgrade to v3 architecture', 'active'),
  ('00000000-0000-0000-0001-000000000003', 'lp-3', 'Analytics Dashboard', 'Customer-facing analytics and reporting', 'active'),
  ('00000000-0000-0000-0001-000000000004', 'lp-4', 'Mobile App Refresh', 'Complete mobile app redesign', 'active'),
  ('00000000-0000-0000-0001-000000000005', 'lp-5', 'API Gateway', 'Centralized API gateway and rate limiting', 'active'),
  ('00000000-0000-0000-0001-000000000006', 'lp-6', 'CI/CD Pipeline', 'Build and deployment automation', 'active')
on conflict (linear_project_id) do nothing;

insert into daily_snapshots (date, engineer_id, delivery_score, collaboration_score, prs_merged, reviews_given, avg_cycle_time_hours, avg_review_turnaround_hours, commits_count, lines_added, lines_removed) values
  (current_date, '00000000-0000-0000-0000-000000000001', 94, 72, 14, 8, 12, 2.5, 32, 1840, 420),
  (current_date, '00000000-0000-0000-0000-000000000002', 87, 65, 11, 6, 18, 3.1, 28, 1520, 380),
  (current_date, '00000000-0000-0000-0000-000000000003', 79, 88, 8, 15, 24, 1.8, 22, 980, 210),
  (current_date, '00000000-0000-0000-0000-000000000004', 75, 91, 6, 22, 36, 1.2, 14, 620, 180),
  (current_date, '00000000-0000-0000-0000-000000000005', 82, 78, 10, 12, 16, 2.8, 26, 1380, 340),
  (current_date, '00000000-0000-0000-0000-000000000006', 71, 84, 7, 19, 28, 1.5, 18, 740, 220),
  (current_date, '00000000-0000-0000-0000-000000000007', 88, 62, 12, 5, 14, 4.2, 35, 2100, 560),
  (current_date, '00000000-0000-0000-0000-000000000008', 66, 73, 5, 10, 32, 2.9, 12, 480, 140),
  (current_date, '00000000-0000-0000-0000-000000000009', 73, 80, 9, 17, 22, 1.9, 20, 860, 190),
  (current_date, '00000000-0000-0000-0000-00000000000a', 69, 86, 4, 21, 40, 1.3, 10, 380, 120),
  (current_date, '00000000-0000-0000-0000-00000000000b', 85, 70, 13, 9, 15, 3.0, 30, 1680, 410),
  (current_date, '00000000-0000-0000-0000-00000000000c', 77, 67, 8, 7, 22, 3.5, 24, 1120, 280)
on conflict (date, engineer_id) do nothing;
