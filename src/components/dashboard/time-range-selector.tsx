"use client";

import { useState } from "react";
import { TIME_RANGES, DEFAULT_TIME_RANGE, type TimeRange } from "@/config/constants";
import { cn } from "@/lib/utils";

const LABELS: Record<TimeRange, string> = {
  today: "Today",
  week: "This Week",
  sprint: "Sprint",
  month: "Month",
  quarter: "Quarter",
};

export function TimeRangeSelector() {
  const [selected, setSelected] = useState<TimeRange>(DEFAULT_TIME_RANGE);

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          onClick={() => setSelected(range)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            selected === range
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[range]}
        </button>
      ))}
    </div>
  );
}
