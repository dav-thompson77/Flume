"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CircleCheck,
  History,
  Info,
  Percent,
  Receipt,
  RotateCcw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";

type Decision = "approved" | "more_review" | "rejected";

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approved",
  more_review: "Requested More Review",
  rejected: "Rejected",
};

// Mock financial snapshot for this frontend-only stage (FLUME.md section 11).
const FINANCIALS = [
  { label: "Revenue", value: "$23,900", icon: Wallet },
  { label: "Expenses", value: "$18,400", icon: Receipt },
  { label: "Expense Ratio", value: "76.99%", icon: Percent },
  { label: "Average Order Value", value: "$187", icon: TrendingUp },
] as const;

type FlagSeverity = "attention" | "neutral" | "positive";

const RISK_FLAGS: { label: string; severity: FlagSeverity }[] = [
  { label: "Low-confidence transaction detected", severity: "attention" },
  { label: "Expense ratio within review threshold", severity: "neutral" },
  { label: "No obvious revenue anomaly detected", severity: "positive" },
];

const FLAG_STYLES: Record<
  FlagSeverity,
  { icon: typeof TriangleAlert; border: string; bg: string; text: string; srLabel: string }
> = {
  attention: {
    icon: TriangleAlert,
    border: "border-amber-400/30",
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    srLabel: "Needs attention",
  },
  neutral: {
    icon: Info,
    border: "border-border",
    bg: "bg-surface",
    text: "text-foreground-muted",
    srLabel: "Informational",
  },
  positive: {
    icon: CircleCheck,
    border: "border-accent-secondary/30",
    bg: "bg-accent-secondary/10",
    text: "text-accent-secondary",
    srLabel: "Positive indicator",
  },
};

type Transaction = {
  vendor: string;
  date: string;
  amount: string;
  category: string;
  confidence: number;
};

// Mock extracted transactions (FLUME.md section 11, "Transaction Evidence").
// Vendor/place names are illustrative Caribbean-style examples, not real businesses.
const TRANSACTIONS: Transaction[] = [
  { vendor: "Kingston Hardware Supplies", date: "2026-01-03", amount: "$842.00", category: "Inventory", confidence: 0.96 },
  { vendor: "Half Moon Bay Bakery", date: "2026-01-05", amount: "$215.50", category: "Supplies", confidence: 0.91 },
  { vendor: "Portmore Wholesale Foods", date: "2026-01-08", amount: "$1,340.00", category: "Inventory", confidence: 0.88 },
  { vendor: "Blue Mountain Coffee Traders", date: "2026-01-10", amount: "$67.25", category: "Supplies", confidence: 0.64 },
  { vendor: "Falmouth Fuel & Gas", date: "2026-01-12", amount: "$310.00", category: "Utilities", confidence: 0.93 },
  { vendor: "Ocho Rios Print & Signage", date: "2026-01-15", amount: "$145.00", category: "Marketing", confidence: 0.77 },
  { vendor: "Spanish Town Equipment Rentals", date: "2026-01-18", amount: "$980.00", category: "Equipment", confidence: 0.82 },
];

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const DECISION_BUTTON_BASE =
  "inline-flex flex-1 items-center justify-center gap-2 rounded-button px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed";

function decisionButtonClass(kind: Decision, decision: Decision | null): string {
  const isSelected = decision === kind;

  if (isSelected) {
    if (kind === "approved") return "bg-accent text-white";
    if (kind === "rejected") return "border border-red-400/40 bg-red-400/10 text-red-400";
    return "border border-accent/40 bg-accent/10 text-foreground";
  }

  if (decision !== null) {
    return "border border-border bg-surface-alt text-foreground-muted";
  }

  if (kind === "approved") return "bg-accent text-white hover:bg-accent/90";
  if (kind === "rejected") return "border border-red-400/30 text-red-400 hover:bg-red-400/10";
  return "border border-accent/30 text-foreground hover:bg-accent/10";
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

  const [decision, setDecision] = useState<Decision | null>(null);

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

  const merchantLabel = merchantName ?? "Merchant application";

  return (
    <main className="flex flex-1 justify-center px-6 py-12 sm:px-8 sm:py-16 lg:py-20">
      <div className="mx-auto flex w-full max-w-content flex-col gap-10 sm:gap-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Underwriting Review
              </h1>
              <p className="mt-2 max-w-2xl text-base text-foreground-secondary sm:text-lg">
                Review Flume&apos;s analysis before making a final underwriting decision.
              </p>
            </div>
            <span className="shrink-0 rounded-badge border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              Awaiting Review
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-muted">
            <span className="font-semibold text-foreground">{merchantLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Application {applicationId}</span>
          </div>
        </header>

        <section
          aria-labelledby="ai-recommendation-heading"
          className="rounded-card border border-border bg-surface p-6 shadow-large sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="ai-recommendation-heading" className="text-lg font-bold text-foreground sm:text-xl">
              AI Underwriting Recommendation
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Manual Review
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground-secondary sm:text-base">
            Flume flagged this application for human review because one or more extracted
            transactions have lower confidence.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            AI-generated recommendation · Not a final decision
          </p>
        </section>

        <section aria-labelledby="financial-overview-heading">
          <h2 id="financial-overview-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Financial Overview
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Metrics calculated from the extracted transactions below.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FINANCIALS.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-card border border-border bg-surface p-5 shadow-large"
              >
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="risk-flags-heading">
          <h2 id="risk-flags-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Risk Flags
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {RISK_FLAGS.map((flag) => {
              const style = FLAG_STYLES[flag.severity];
              const Icon = style.icon;
              return (
                <li
                  key={flag.label}
                  className={`flex items-center gap-3 rounded-card border p-4 ${style.border} ${style.bg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${style.text}`} aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{flag.label}</span>
                  <span className="sr-only">{style.srLabel}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="transactions-heading">
          <h2 id="transactions-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Extracted Transactions
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Underlying evidence Flume extracted from the uploaded records.
          </p>
          <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface shadow-large">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Vendor
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody>
                {TRANSACTIONS.map((tx) => {
                  const isLowConfidence = tx.confidence < LOW_CONFIDENCE_THRESHOLD;
                  return (
                    <tr
                      key={`${tx.vendor}-${tx.date}`}
                      className={`border-b border-border transition-colors duration-200 last:border-0 hover:bg-surface-alt/60 ${
                        isLowConfidence ? "bg-amber-400/5" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{tx.vendor}</td>
                      <td className="px-5 py-3 text-foreground-secondary">{tx.date}</td>
                      <td className="px-5 py-3 text-foreground-secondary">{tx.amount}</td>
                      <td className="px-5 py-3 text-foreground-secondary">{tx.category}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-badge px-2.5 py-1 text-xs font-semibold ${
                            isLowConfidence
                              ? "bg-amber-400/10 text-amber-400"
                              : "bg-accent-secondary/10 text-accent-secondary"
                          }`}
                        >
                          {Math.round(tx.confidence * 100)}%
                        </span>
                        {isLowConfidence && <span className="sr-only"> — Low confidence</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="human-decision-heading"
          className="rounded-card border border-border bg-surface p-6 shadow-large sm:p-8"
        >
          <h2 id="human-decision-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Human Decision
          </h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Confirm the AI recommendation or send this application for additional review.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setDecision("approved")}
              disabled={decision !== null}
              aria-pressed={decision === "approved"}
              className={`${DECISION_BUTTON_BASE} ${decisionButtonClass("approved", decision)}`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecision("more_review")}
              disabled={decision !== null}
              aria-pressed={decision === "more_review"}
              className={`${DECISION_BUTTON_BASE} ${decisionButtonClass("more_review", decision)}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Request More Review
            </button>
            <button
              type="button"
              onClick={() => setDecision("rejected")}
              disabled={decision !== null}
              aria-pressed={decision === "rejected"}
              className={`${DECISION_BUTTON_BASE} ${decisionButtonClass("rejected", decision)}`}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              Reject
            </button>
          </div>

          {decision && (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 flex flex-col items-start gap-4 border-t border-border pt-6"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CircleCheck className="h-4 w-4 text-accent-secondary" aria-hidden="true" />
                Decision recorded: {DECISION_LABELS[decision]}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/report/${applicationId}`)}
                className="rounded-button bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
              >
                View Underwriting Report
              </button>
            </div>
          )}

          <p className="mt-6 flex items-center gap-2 text-xs text-foreground-muted">
            <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Human decisions will be recorded in the underwriting audit trail.
          </p>
        </section>
      </div>
    </main>
  );
}
