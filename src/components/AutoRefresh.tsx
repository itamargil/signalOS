"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Soft-refreshes the current route's server data on an interval (no full reload,
 * client state preserved) so new gates/results appear without a manual refresh.
 * Pass active=false to pause (e.g. while a gate is waiting on the user — nothing
 * changes server-side until they act).
 */
export function AutoRefresh({
  active,
  intervalMs = 2000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(iv);
  }, [active, intervalMs, router]);
  return null;
}
