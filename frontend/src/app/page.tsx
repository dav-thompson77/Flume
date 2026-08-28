"use client";

import { useEffect, useState } from "react";

type BackendStatus = "checking" | "connected" | "offline";

export default function Home() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    fetch(`${apiUrl}/health`)
      .then((res) => setStatus(res.ok ? "connected" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  const message =
    status === "checking"
      ? "Backend: Checking..."
      : status === "connected"
        ? "Backend: ✓ Connected"
        : "Backend: ✕ Offline";

  return (
    <main className="flex flex-1 items-center justify-center">
      <p>{message}</p>
    </main>
  );
}
