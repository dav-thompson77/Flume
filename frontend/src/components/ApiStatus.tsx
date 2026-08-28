"use client";

import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import type { HealthResponse } from "@/types/api";

type Status = "loading" | "online" | "offline";

export function ApiStatus() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    apiFetch<HealthResponse>("/api/v1/health")
      .then((data) => {
        if (!cancelled) setStatus(data.status === "ok" ? "online" : "offline");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("offline");
        if (error instanceof ApiError) {
          console.error(`API returned ${error.status}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dotColor =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-red-500"
        : "bg-amber-400";

  const label =
    status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking backend…";

  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
      <span className={`h-2 w-2 rounded-full ${dotColor} ${status === "loading" ? "animate-pulse" : ""}`} />
      {label}
    </div>
  );
}
