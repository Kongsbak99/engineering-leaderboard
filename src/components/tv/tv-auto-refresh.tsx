"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TV_REFRESH_INTERVAL_MS } from "@/config/constants";

export function TVAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, TV_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
