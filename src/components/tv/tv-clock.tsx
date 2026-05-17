"use client";

import { useState, useEffect } from "react";

export function TVClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function update() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    }
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <span className="text-lg font-mono font-medium text-muted-foreground tabular-nums">
      {time}
    </span>
  );
}
