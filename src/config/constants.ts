export const TIME_RANGES = ["today", "week", "sprint", "month", "quarter"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const DEFAULT_TIME_RANGE: TimeRange = "week";

export const TV_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const TV_ROTATION_INTERVAL_MS = 30 * 1000; // 30 seconds between panels

export const LEADERBOARD_DISPLAY_COUNT = 10;
export const TV_LEADERBOARD_DISPLAY_COUNT = 8;
