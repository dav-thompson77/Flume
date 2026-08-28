"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CircleCheck,
  Gauge,
  Info,
  Percent,
  Plus,
  Receipt,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";

// Mock financial snapshot - kept identical to the Human Review page
// (FLUME.md section 11 / 12) so the two pages agree with each other.
const FINANCIALS = [
  { label: "Revenue", value: "$23,900", icon: Wallet },
  { label: "Expenses", value: "$18,400", icon: Receipt },
  { label: "Expense Ratio", value: "76.99%", icon: Percent },
  { label: "Average Order Value", value: "$187", icon: TrendingUp },
] as const;

type FlagSeverity = "attention" | "neutral" | "positive";

const RISK_FINDINGS: { label: string; severity: FlagSeverity }[] = [
  { label: "Low-confidence transaction detected", severity: "attention" },
  { label: "Expense ratio below the high-risk threshold", severity: "positive" },
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

// Same mock transactions shown on the Human Review page - kept identical
// so the two pages describe the same underwriting evidence.
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

type AuditEvent = {
  title: string;
  description: string;
  timestamp: string;
};

// Mock audit trail (FLUME.md section 12/21). Frontend-only - these events
// are not actually persisted anywhere yet.
const AUDIT_EVENTS: AuditEvent[] = [
  {
    title: "Application created",
    description: "Flume created a new underwriting application for this merchant.",
    timestamp: "Jan 20, 2026 · 9:02 AM",
  },
  {
    title: "Financial records uploaded",
    description: "The bank worker uploaded receipts and transaction records for review.",
    timestamp: "Jan 20, 2026 · 9:03 AM",
  },
  {
    title: "Transactions extracted",
    description: "Flume extracted structured transaction data from the uploaded records.",
    timestamp: "Jan 20, 2026 · 9:04 AM",
  },
  {
    title: "Underwriting analysis completed",
    description: "Flume calculated financial health metrics and evaluated risk rules.",
    timestamp: "Jan 20, 2026 · 9:05 AM",
  },
  {
    title: "AI recommendation generated",
    description: "Flume produced a recommendation based on the calculated metrics and extracted evidence.",
    timestamp: "Jan 20, 2026 · 9:05 AM",
  },
  {
    title: "Human review completed",
    description: "A bank reviewer examined the AI findings and extracted transactions.",
    timestamp: "Jan 20, 2026 · 9:12 AM",
  },
  {
    title: "Application approved",
    description: "The reviewer approved the application following manual review.",
    timestamp: "Jan 20, 2026 · 9:12 AM",
  },
];

export default function ReportPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

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

  const merchantLabel = merchantName ?? "Merchant Application";

  return (
    <main className="flex flex-1 justify-center px-6 py-12 sm:px-8 sm:py-16 lg:py-20">
      <div className="mx-auto flex w-full max-w-content flex-col gap-10 sm:gap-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Underwriting Report
              </h1>
              <p className="mt-2 max-w-2xl text-base text-foreground-secondary sm:text-lg">
                AI-assisted financial analysis and underwriting decision.
              </p>
            </div>
            <span className="shrink-0 rounded-badge border border-accent-secondary/30 bg-accent-secondary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent-secondary">
              Review completed
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-muted">
            <span className="font-semibold text-foreground">{merchantLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Application {applicationId}</span>
          </div>
        </header>

        <section
          aria-labelledby="final-decision-heading"
          className="rounded-card border border-accent/30 bg-accent/10 p-6 shadow-large sm:p-8"
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <BadgeCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="final-decision-heading"
                  className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
                >
                  APPROVED
                </h2>
                <p className="text-sm font-semibold text-foreground-secondary">Human decision</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-badge border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              AI Recommendation: Manual Review
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground-secondary sm:text-base">
            Approved after reviewing Flume&apos;s financial analysis.
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

        <section aria-labelledby="risk-assessment-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="risk-assessment-heading" className="text-lg font-bold text-foreground sm:text-xl">
              Risk Assessment
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              Medium Risk
            </span>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {RISK_FINDINGS.map((flag) => {
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
            Transaction Summary
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            The same extracted transactions reviewed during underwriting.
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
          aria-labelledby="underwriting-decision-heading"
          className="rounded-card border border-border bg-surface p-6 shadow-large sm:p-8"
        >
          <h2
            id="underwriting-decision-heading"
            className="text-lg font-bold text-foreground sm:text-xl"
          >
            Underwriting Decision
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                AI Recommendation
              </dt>
              <dd className="mt-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-badge border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Manual Review
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Human Decision
              </dt>
              <dd className="mt-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-badge border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Approved
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Reviewer Action
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-foreground">Approved</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Reason
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
                Financial performance was considered acceptable after review of the extracted
                transactions and risk flags.
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="audit-trail-heading">
          <h2 id="audit-trail-heading" className="text-lg font-bold text-foreground sm:text-xl">
            Audit Trail
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            The sequence of actions recorded for this application.
          </p>
          <ol className="mt-4 flex flex-col rounded-card border border-border bg-surface p-6 shadow-large sm:p-8">
            {AUDIT_EVENTS.map((event, index) => (
              <li key={event.title} className="relative flex gap-4 pb-6 last:pb-0">
                {index < AUDIT_EVENTS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border"
                  />
                )}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <CircleCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex-1 pt-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-foreground">{event.title}</p>
                    <span className="text-xs text-foreground-muted">{event.timestamp}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground-secondary">{event.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="ai-summary-heading"
          className="rounded-card border border-border bg-surface p-6 shadow-large sm:p-8"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 id="ai-summary-heading" className="text-lg font-bold text-foreground sm:text-xl">
              AI Summary
            </h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground-secondary sm:text-base">
            Revenue and transaction activity indicate a consistently operating business. Expenses
            represent a significant portion of revenue but remain below the high-risk threshold
            used in this assessment. One low-confidence transaction was identified and reviewed
            during underwriting.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            AI-generated summary
          </p>
        </section>

        <section aria-labelledby="report-metadata-heading" className="rounded-card border border-border bg-surface/60 p-6">
          <h2 id="report-metadata-heading" className="sr-only">
            Report metadata
          </h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Application ID
              </dt>
              <dd className="mt-1 text-foreground">{applicationId}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Analysis
              </dt>
              <dd className="mt-1 text-foreground">Flume AI Underwriting</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                Review
              </dt>
              <dd className="mt-1 text-foreground">Human-in-the-loop</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => router.push(`/review/${applicationId}`)}
            className="inline-flex items-center justify-center gap-2 rounded-button border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface-alt"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Review
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center gap-2 rounded-button bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Start New Application
          </button>
        </div>
      </div>
    </main>
  );
}
