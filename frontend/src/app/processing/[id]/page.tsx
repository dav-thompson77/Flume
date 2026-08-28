"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Circle, Loader2 } from "lucide-react";

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
  const applicationId = params.id;

  // Step 0 ("Upload Complete") starts already done, which puts step 1
  // ("Extracting Transactions") into the active state immediately.
  const [completedCount, setCompletedCount] = useState(1);

  // One-time read of what the Upload page stored for this application id.
  // Guarded for the server-rendered pass, where sessionStorage doesn't exist.
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
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setCompletedCount(2), STEP_DURATION_MS),
      setTimeout(() => setCompletedCount(3), STEP_DURATION_MS * 2),
      setTimeout(() => setCompletedCount(4), STEP_DURATION_MS * 3),
      setTimeout(() => {
        router.replace(`/review/${applicationId}`);
      }, STEP_DURATION_MS * 3 + NAVIGATE_DELAY_MS),
    ];

    return () => timers.forEach(clearTimeout);
  }, [applicationId, router]);

  const activeIndex = Math.min(completedCount, STEPS.length - 1);
  const currentStepNumber = activeIndex + 1;
  const progressPercent = Math.min((completedCount / STEPS.length) * 100, 100);
  const contextLine = merchantName
    ? `Analyzing records for ${merchantName}.`
    : "Analyzing merchant records.";

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
            <span>{STEPS[activeIndex]}</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-badge bg-surface-alt">
            <div
              className="h-full rounded-badge bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <ol className="mt-8 flex flex-col gap-5 text-left">
            {STEPS.map((label, index) => {
              const state = stepState(index, completedCount);

              return (
                <li key={label} className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                      state === "completed"
                        ? "bg-accent text-white"
                        : state === "active"
                          ? "bg-accent/10 text-accent"
                          : "bg-surface-alt text-foreground-muted"
                    }`}
                  >
                    {state === "completed" && <Check className="h-4 w-4" />}
                    {state === "active" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {state === "waiting" && <Circle className="h-3.5 w-3.5" />}
                  </span>
                  <span
                    className={`text-sm font-medium transition-colors duration-200 ${
                      state === "waiting" ? "text-foreground-muted" : "text-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="sr-only">
                    {state === "completed"
                      ? "Completed"
                      : state === "active"
                        ? "In progress"
                        : "Waiting"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </main>
  );
}
