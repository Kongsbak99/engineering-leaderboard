import { getServiceClient } from "@/lib/supabase/client";
import { getLinearClient } from "./client";

async function getOrCreateEngineerByLinear(
  supabase: ReturnType<typeof getServiceClient>,
  linearUserId: string,
  displayName: string,
  avatarUrl?: string
) {
  const { data: existing } = await supabase
    .from("engineers")
    .select("id")
    .eq("linear_id", linearUserId)
    .single();

  if (existing) return existing.id;

  const placeholderGithub = `linear-${linearUserId}`;

  const { data: created, error } = await supabase
    .from("engineers")
    .upsert(
      {
        github_username: placeholderGithub,
        linear_id: linearUserId,
        display_name: displayName,
        avatar_url: avatarUrl ?? null,
      },
      { onConflict: "linear_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return created!.id;
}

async function getOrCreateProject(
  supabase: ReturnType<typeof getServiceClient>,
  linearProjectId: string,
  name: string,
  description?: string
) {
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("linear_project_id", linearProjectId)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("projects")
    .upsert(
      {
        linear_project_id: linearProjectId,
        name,
        description: description ?? null,
        status: "active",
      },
      { onConflict: "linear_project_id" }
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

export async function syncLinear() {
  const supabase = getServiceClient();
  const linear = getLinearClient();
  const lastSync = await getLastSync(supabase, "linear");

  let totalIssues = 0;
  let totalProjects = 0;

  // Sync projects
  const projectsConnection = await linear.projects({
    first: 50,
    orderBy: "updatedAt" as never,
  });

  for (const project of projectsConnection.nodes) {
    await getOrCreateProject(
      supabase,
      project.id,
      project.name,
      project.description ?? undefined
    );
    totalProjects++;
  }

  // Sync issues — fetch recently updated
  const filter: Record<string, unknown> = {};
  if (lastSync) {
    filter.updatedAt = { gte: lastSync };
  }

  let hasMore = true;
  let afterCursor: string | undefined;

  while (hasMore) {
    const issuesConnection = await linear.issues({
      first: 100,
      after: afterCursor,
      filter,
      orderBy: "updatedAt" as never,
    });

    for (const issue of issuesConnection.nodes) {
      let engineerId: string | null = null;
      const assignee = await issue.assignee;
      if (assignee) {
        engineerId = await getOrCreateEngineerByLinear(
          supabase,
          assignee.id,
          assignee.name,
          assignee.avatarUrl ?? undefined
        );
      }

      let projectId: string | null = null;
      const issueProject = await issue.project;
      if (issueProject) {
        projectId = await getOrCreateProject(
          supabase,
          issueProject.id,
          issueProject.name,
          issueProject.description ?? undefined
        );
      }

      const state = await issue.state;
      const stateName = state?.name ?? "Unknown";

      const startedAt = issue.startedAt ?? null;
      const completedAt = issue.completedAt ?? null;

      let cycleTimeHours: number | null = null;
      if (startedAt && completedAt) {
        const start = new Date(startedAt).getTime();
        const end = new Date(completedAt).getTime();
        cycleTimeHours = (end - start) / (1000 * 60 * 60);
      }

      await supabase.from("linear_issues").upsert(
        {
          linear_issue_id: issue.id,
          engineer_id: engineerId,
          project_id: projectId,
          identifier: issue.identifier,
          title: issue.title.slice(0, 500),
          priority: issue.priority,
          state: stateName,
          created_at: issue.createdAt,
          started_at: startedAt,
          completed_at: completedAt,
          cycle_time_hours: cycleTimeHours,
        },
        { onConflict: "linear_issue_id" }
      );
      totalIssues++;
    }

    hasMore = issuesConnection.pageInfo.hasNextPage;
    afterCursor = issuesConnection.pageInfo.endCursor ?? undefined;

    if (totalIssues > 2000) break;
  }

  await updateLastSync(supabase, "linear");

  return { totalIssues, totalProjects };
}
