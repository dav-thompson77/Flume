"use client";

// TEMPORARY DIAGNOSTIC PAGE
// Replaces the simple "Backend: Connected/Offline" checkpoint page while we
// debug the deployed frontend failing to reach the deployed backend. Shows
// the raw request URL, HTTP status, response body, and any fetch error with
// nothing hidden. Revert to the simple checkpoint page once diagnosed.

import { useState } from "react";

type TestResult = {
  url: string;
  status?: number;
  body?: string;
  error?: string;
};

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const testBackend = async () => {
    const url = `${apiUrl}/health`;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(url);
      const body = res.ok ? await res.text() : undefined;
      setResult({ url, status: res.status, body });
    } catch (err) {
      setResult({
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 font-mono text-sm">
      <p>NEXT_PUBLIC_API_URL: {String(apiUrl)}</p>

      <button
        onClick={testBackend}
        disabled={loading}
        className="rounded border border-black px-4 py-2 disabled:opacity-50 dark:border-white"
      >
        {loading ? "Testing..." : "Test Backend"}
      </button>

      {result && (
        <div className="w-full max-w-xl whitespace-pre-wrap break-all rounded border border-black/20 p-4 dark:border-white/20">
          <p>Request URL: {result.url}</p>
          {result.status !== undefined && <p>Status: {result.status}</p>}
          {result.body !== undefined && <p>Body: {result.body}</p>}
          {result.error !== undefined && <p>Error: {result.error}</p>}
        </div>
      )}
    </main>
  );
}
