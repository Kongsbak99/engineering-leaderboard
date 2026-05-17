"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url: string | null;
  score: number;
  subtitle?: string;
  badge?: string;
}

interface LeaderboardCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  entries: LeaderboardEntry[];
  maxEntries?: number;
  scoreLabel?: string;
  scoreSuffix?: string;
  accentClass?: string;
  large?: boolean;
}

function getRankStyle(rank: number) {
  if (rank === 0) return "text-amber-500 font-bold text-lg";
  if (rank === 1) return "text-muted-foreground/80 font-semibold text-base";
  if (rank === 2) return "text-amber-700/60 font-semibold text-base";
  return "text-muted-foreground text-sm";
}

function getRankIcon(rank: number) {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return `${rank + 1}`;
}

function getScoreBarWidth(score: number, maxScore: number) {
  return Math.max(20, (score / maxScore) * 100);
}

export function LeaderboardCard({
  title,
  description,
  icon: Icon,
  entries,
  maxEntries = 8,
  scoreLabel = "Score",
  scoreSuffix = "",
  accentClass = "bg-primary/10 text-primary",
  large,
}: LeaderboardCardProps) {
  const displayed = entries.slice(0, maxEntries);
  const maxScore = Math.max(...displayed.map((e) => e.score), 1);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={cn("pb-3", large && "pb-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("rounded-lg p-1.5", accentClass)}>
            <Icon className={cn("h-4 w-4", large && "h-5 w-5")} />
          </div>
          <div>
            <CardTitle className={cn("text-base", large && "text-lg")}>
              {title}
            </CardTitle>
            <p className={cn(
              "text-xs text-muted-foreground",
              large && "text-sm"
            )}>
              {description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <div className="flex items-center justify-between px-1 pb-2 text-xs font-medium text-muted-foreground">
          <span>Engineer</span>
          <span>{scoreLabel}</span>
        </div>
        <div className="space-y-1">
          {displayed.map((entry, i) => (
            <div
              key={entry.id}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50",
                i === 0 && "bg-muted/30",
                large && "py-3"
              )}
            >
              <span
                className={cn(
                  "w-7 text-center shrink-0",
                  getRankStyle(i),
                  large && "w-9 text-lg"
                )}
              >
                {getRankIcon(i)}
              </span>
              <Avatar className={cn("h-7 w-7", large && "h-9 w-9")}>
                <AvatarImage src={entry.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {entry.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium text-sm truncate",
                      large && "text-base"
                    )}
                  >
                    {entry.name}
                  </span>
                  {entry.badge && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      {entry.badge}
                    </Badge>
                  )}
                </div>
                {entry.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      i === 0
                        ? "bg-primary"
                        : i < 3
                          ? "bg-primary/70"
                          : "bg-primary/40"
                    )}
                    style={{
                      width: `${getScoreBarWidth(entry.score, maxScore)}%`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums w-10 text-right",
                    large && "text-base w-12"
                  )}
                >
                  {entry.score}
                  {scoreSuffix}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
