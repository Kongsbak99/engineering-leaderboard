import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  large?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  large,
}: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className={cn("p-4", large && "p-6")}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn(
              "text-sm font-medium text-muted-foreground",
              large && "text-base"
            )}>
              {title}
            </p>
            <p className={cn(
              "text-2xl font-bold tracking-tight",
              large && "text-4xl"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "rounded-lg bg-primary/10 p-2",
            large && "p-3"
          )}>
            <Icon className={cn(
              "h-4 w-4 text-primary",
              large && "h-6 w-6"
            )} />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            <span
              className={cn(
                "text-xs font-medium",
                trend.value >= 0 ? "text-emerald-500" : "text-destructive"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
