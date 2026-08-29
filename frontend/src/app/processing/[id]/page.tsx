"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import { ApiError, processApplication } from "@/lib/api";

type StepState = "completed" | "active" | "waiting";

const STEPS = [
  "Upload Complete",
  "Extracting Transactions",
  "Running Underwriting Analysis",
  "Preparing Review",
] as const;

const STEP_DURATION_MS = 2000;
const NAVIGATE_DELAY_MS = 800;

function stepState(index: number, completedCount: number): StepState {
  if (index < completedCount) return "completed";
  if (index === completedCount) return "active";
  return "waiting";
}

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const applicationId =
    (typeof params.id === "string" && params.id) ||
    pathname.split("/").filter(Boolean).pop() ||
    "";

  // Step 0 ("Upload Complete") starts already done, which puts step 1
  // ("Extracting Transactions") into the active state immediately.
  const [completedCount, setCompletedCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Optional merchant name stashed by the Upload page for this real UUID.
  const [merchantName] = useState<string | null>(() => {
    if (typeof window === "undefined" || !applicationId) return null;
    try {
      const raw = sessionStorage.getItem(`flume:application:${applicationId}`);
      if (!raw) return null;
      const stored = JSON.parse(raw) as { merchantName?: string };
      return stored.merchantName ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!applicationId) {
      const timer = setTimeout(() => {
        setError("Missing application id.");
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const visualTimers = [
      setTimeout(() => {
        if (!cancelled) setCompletedCount((count) => (count >= 4 ? count : Math.min(Math.max(count, 2), 3)));
      }, STEP_DURATION_MS),
      setTimeout(() => {
        if (!cancelled) setCompletedCount((count) => (count >= 4 ? count : Math.min(Math.max(count, 3), 3)));
      }, STEP_DURATION_MS * 2),
    ];
    timers.push(...visualTimers);

    processApplication(applicationId)
      .then(() => {
        if (cancelled) return;
        visualTimers.forEach(clearTimeout);
        setCompletedCount(4);
        timers.push(
          setTimeout(() => {
            if (!cancelled) router.replace(`/review/${applicationId}`);
          }, NAVIGATE_DELAY_MS),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        visualTimers.forEach(clearTimeout);
        const message =
          err instanceof ApiError
            ? err.message
            : "Processing failed. Please try again.";
        setError(message);
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // router.replace is used only after a successful process call.
    // Omitting `router` keeps this effect from restarting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [applicationId, attempt]);

  const activeIndex = Math.min(completedCount, STEPS.length - 1);
  const currentStepNumber = activeIndex + 1;
  const progressPercent = Math.min((completedCount / STEPS.length) * 100, 100);
  const contextLine = merchantName
    ? `Analyzing records for ${merchantName}.`
    : "Analyzing merchant records.";
  const statusLabel =
    error
      ? "Processing failed"
      : completedCount >= 2 && completedCount < 3
        ? "Extracting transactions..."
        : completedCount >= 3 && completedCount < 4
          ? "Running underwriting analysis..."
          : STEPS[activeIndex];

  return (
    <main className="flex flex-1 justify-center px-6 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Analyzing Financial Records
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foreground-secondary sm:text-lg">
          Flume is extracting transaction data and evaluating the merchant&apos;s financial
          health.
        </p>
        <p className="mt-2 text-sm text-foreground-muted">{contextLine}</p>

        <div className="mt-10 w-full rounded-card border border-border bg-surface p-6 shadow-large sm:mt-12 sm:p-8">
          <div
            role="status"
            aria-live="polite"
            className="mb-6 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-widest text-foreground-muted"
          >
            <span>
              Step {currentStepNumber} of {STEPS.length}
            </span>
            <span>{statusLabel}</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-badge bg-surface-alt">
            <div
              className="h-full rounded-badge bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <ol className="mt-8 flex flex-col gap-5 text-left">
            {STEPS.map((label, index) => {
              const state = error
                ? index < completedCount
                  ? "completed"
                  : index === completedCount
                    ? "active"
                    : "waiting"
                : stepState(index, completedCount);

              return (
                <li key={label} className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                      error && index === completedCount
                        ? "bg-red-400/10 text-red-400"
                        : state === "completed"
                          ? "bg-accent text-white"
                          : state === "active"
                            ? "bg-accent/10 text-accent"
                            : "bg-surface-alt text-foreground-muted"
                    }`}
                  >
                    {error && index === completedCount ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <>
                        {state === "completed" && <Check className="h-4 w-4" />}
                        {state === "active" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {state === "waiting" && <Circle className="h-3.5 w-3.5" />}
                      </>
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium transition-colors duration-200 ${
                      state === "waiting" ? "text-foreground-muted" : "text-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="sr-only">
                    {error && index === completedCount
                      ? "Failed"
                      : state === "completed"
                        ? "Completed"
                        : state === "active"
                          ? "In progress"
                          : "Waiting"}
                  </span>
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-6">
              <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCompletedCount(1);
                  setAttempt((value) => value + 1);
                }}
                className="rounded-button bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
              >
                Retry processing
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
