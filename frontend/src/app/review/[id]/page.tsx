"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  CircleCheck,
  History,
  Info,
  Loader2,
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
import {
  ApiError,
  getApplicationReport,
  type ApplicationReport,
  type UnderwritingAction,
} from "@/lib/api";
import {
  formatLabel,
  formatMoney,
  formatRatio,
  formatTimestamp,
  riskBadgeClass,
  statusBadgeClass,
} from "@/lib/format";

type Decision = "approved" | "more_review" | "rejected";

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approved",
  more_review: "Requested More Review",
  rejected: "Rejected",
};

type FlagSeverity = "attention" | "neutral" | "positive";

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

function flagSeverityForRisk(riskLevel: string): FlagSeverity {
  const key = riskLevel.toUpperCase();
  if (key === "HIGH") return "attention";
  if (key === "MEDIUM") return "attention";
  if (key === "LOW") return "positive";
  return "neutral";
}

function latestAction(actions: UnderwritingAction[]): UnderwritingAction | null {
  if (actions.length === 0) return null;
  return actions[actions.length - 1];
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const applicationId =
    (typeof params.id === "string" && params.id) ||
    pathname.split("/").filter(Boolean).pop() ||
    "";

  const [decision, setDecision] = useState<Decision | null>(null);
  const [data, setData] = useState<ApplicationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!applicationId) {
      const timer = setTimeout(() => {
        setError("Missing application id.");
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    async function loadReport() {
      try {
        const result = await getApplicationReport(applicationId);
        if (cancelled) return;
        setData(result);
        if (!result.report) {
          setError("No underwriting report is available yet. Process this application first.");
        } else {
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load underwriting results. Please try again.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [applicationId, attempt]);

  if (loading) {
    return (
      <main className="flex flex-1 justify-center px-6 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col items-center gap-3 text-foreground-muted">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
          <p className="text-sm font-medium">Loading underwriting results...</p>
        </div>
      </main>
    );
  }

  if (error || !data?.report) {
    return (
      <main className="flex flex-1 justify-center px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-card border border-border bg-surface p-6 text-center shadow-large sm:p-8">
          <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error ?? "Could not load underwriting results."}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
            className="rounded-button bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const { application, transactions, report, underwriting_actions: actions } = data;
  const action = latestAction(actions);
  const reason = action?.reason || report.summary || "No underwriting reason was recorded.";
  const merchantLabel = application.merchant_name;
  const financials = [
    { label: "Revenue", value: formatMoney(report.total_revenue), icon: Wallet },
    { label: "Expenses", value: formatMoney(report.total_expenses), icon: Receipt },
    { label: "Expense Ratio", value: formatRatio(report.expense_ratio), icon: Percent },
    { label: "Average Order Value", value: formatMoney(report.average_order_value), icon: TrendingUp },
  ];
  const flagSeverity = flagSeverityForRisk(report.risk_level);
  const FlagIcon = FLAG_STYLES[flagSeverity].icon;

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
                Review Flume&apos;s analysis before treating this result as final.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-badge border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${statusBadgeClass(application.status)}`}
            >
              {formatLabel(application.status)}
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
            <span
              className={`inline-flex items-center gap-1.5 rounded-badge border px-3 py-1 text-xs font-bold uppercase tracking-widest ${riskBadgeClass(report.risk_level)}`}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {formatLabel(report.risk_level)} Risk
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground-secondary sm:text-base">
            {reason}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            System recommendation · Not a final lending decision
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
            {financials.map(({ label, value, icon: Icon }) => (
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
            <li
              className={`flex items-center gap-3 rounded-card border p-4 ${FLAG_STYLES[flagSeverity].border} ${FLAG_STYLES[flagSeverity].bg}`}
            >
              <FlagIcon
                className={`h-5 w-5 shrink-0 ${FLAG_STYLES[flagSeverity].text}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">{reason}</span>
              <span className="sr-only">{FLAG_STYLES[flagSeverity].srLabel}</span>
            </li>
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
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-sm text-foreground-muted">
                      No transactions were extracted for this application.
                    </td>
                  </tr>
                )}
                {transactions.map((tx, index) => {
                  const isLowConfidence = tx.confidence < LOW_CONFIDENCE_THRESHOLD;
                  return (
                    <tr
                      key={tx.id ?? `${tx.vendor}-${tx.transaction_date}-${index}`}
                      className={`border-b border-border transition-colors duration-200 last:border-0 hover:bg-surface-alt/60 ${
                        isLowConfidence ? "bg-amber-400/5" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{tx.vendor}</td>
                      <td className="px-5 py-3 text-foreground-secondary">{tx.transaction_date}</td>
                      <td className="px-5 py-3 text-foreground-secondary">{formatMoney(tx.amount)}</td>
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

        <section aria-labelledby="audit-trail-heading">
          <h2 id="audit-trail-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Audit Trail
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Status changes Flume recorded for this application.
          </p>
          <ol className="mt-4 flex flex-col rounded-card border border-border bg-surface p-6 shadow-large sm:p-8">
            {actions.length === 0 && (
              <li className="text-sm text-foreground-muted">No audit records yet.</li>
            )}
            {actions.map((event, index) => (
              <li key={event.id ?? `${event.action}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
                {index < actions.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border"
                  />
                )}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <CircleCheck className="h-4 w-4" />
                </span>
                <div className="flex-1 pt-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {event.previous_status && event.new_status
                        ? `${formatLabel(event.previous_status)} → ${formatLabel(event.new_status)}`
                        : formatLabel(event.action ?? "Status change")}
                    </p>
                    <span className="text-xs text-foreground-muted">
                      {formatTimestamp(event.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {event.reason || "Status change recorded."}
                    {event.agent_name ? ` · ${event.agent_name}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="human-decision-heading"
          className="rounded-card border border-border bg-surface p-6 shadow-large sm:p-8"
        >
          <h2 id="human-decision-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Human Decision
          </h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Inspect the system result above, then open the final report.
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
            This confirmation stays on this page. It does not change the stored application status.
          </p>
        </section>
      </div>
    </main>
  );
}
