"use client";

import { FolderKanban, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ProjectWithMetrics } from "@/lib/supabase/types";

interface ProjectLeaderboardProps {
  projects: ProjectWithMetrics[];
  maxEntries?: number;
  large?: boolean;
}

function getVelocityColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-destructive";
}

function getProgressColor(pct: number) {
  if (pct >= 75) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-destructive";
}

export function ProjectLeaderboard({
  projects,
  maxEntries = 6,
  large,
}: ProjectLeaderboardProps) {
  const displayed = projects
    .sort((a, b) => b.velocity_score - a.velocity_score)
    .slice(0, maxEntries);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={cn("pb-3", large && "pb-4")}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-1.5 bg-purple-500/10 text-purple-500">
            <FolderKanban className={cn("h-4 w-4", large && "h-5 w-5")} />
          </div>
          <div>
            <CardTitle className={cn("text-base", large && "text-lg")}>
              Project Momentum
            </CardTitle>
            <p className={cn(
              "text-xs text-muted-foreground",
              large && "text-sm"
            )}>
              Velocity, completion & blockers by project
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4 space-y-3">
        {displayed.map((project, i) => (
          <div
            key={project.id}
            className={cn(
              "rounded-lg border p-3 transition-colors hover:bg-muted/30",
              i === 0 && "bg-muted/20 border-primary/20",
              large && "p-4"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={cn(
                      "font-medium text-sm truncate",
                      large && "text-base"
                    )}
                  >
                    {project.name}
                  </h4>
                  {project.blocked_count > 0 && (
                    <Badge
                      variant="destructive"
                      className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
                    >
                      <AlertCircle className="h-2.5 w-2.5" />
                      {project.blocked_count}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {project.completed_count}/{project.ticket_count} tickets
                  {project.avg_cycle_time_hours != null &&
                    ` · ${(project.avg_cycle_time_hours / 24).toFixed(1)}d avg cycle`}
                </p>
              </div>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums shrink-0",
                  getVelocityColor(project.velocity_score),
                  large && "text-xl"
                )}
              >
                {project.velocity_score}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={project.completion_pct}
                className={cn("h-1.5 flex-1", getProgressColor(project.completion_pct))}
              />
              <span className="text-xs font-medium text-muted-foreground tabular-nums w-8 text-right">
                {project.completion_pct}%
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
