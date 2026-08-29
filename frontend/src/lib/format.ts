/** Display helpers for backend values. These format data; they do not decide risk. */

export function formatMoney(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatRatio(ratio: number): string {
  return `${Number((ratio * 100).toFixed(2))}%`;
}

export function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusBadgeClass(status: string): string {
  const key = status.toUpperCase();
  if (key === "HOLD") return "border-red-400/30 bg-red-400/10 text-red-400";
  if (key === "MANUAL_REVIEW") return "border-amber-400/30 bg-amber-400/10 text-amber-400";
  if (key === "CLEAR_FOR_REVIEW") {
    return "border-accent-secondary/30 bg-accent-secondary/10 text-accent-secondary";
  }
  return "border-border bg-surface text-foreground-muted";
}

export function riskBadgeClass(risk: string): string {
  const key = risk.toUpperCase();
  if (key === "HIGH") return "border-red-400/30 bg-red-400/10 text-red-400";
  if (key === "MEDIUM") return "border-amber-400/30 bg-amber-400/10 text-amber-400";
  return "border-accent-secondary/30 bg-accent-secondary/10 text-accent-secondary";
}
