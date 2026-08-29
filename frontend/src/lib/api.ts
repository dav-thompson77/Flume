/**
 * Tiny FastAPI client for the Flume frontend.
 *
 * The backend base URL always comes from NEXT_PUBLIC_API_URL.
 * Pages should call these helpers instead of using fetch directly.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type Application = {
  id: string;
  merchant_name: string;
  status: string;
  created_at?: string;
};

export type Transaction = {
  id?: string;
  document_id?: string;
  vendor: string;
  transaction_date: string;
  amount: number;
  category: string;
  confidence: number;
};

export type UnderwritingReport = {
  total_revenue: number;
  total_expenses: number;
  expense_ratio: number;
  average_order_value: number;
  risk_level: string;
  summary: string;
};

export type UnderwritingAction = {
  id?: string;
  agent_name?: string;
  action?: string;
  reason?: string;
  previous_status?: string | null;
  new_status?: string | null;
  created_at?: string;
};

export type ApplicationReport = {
  application: Application;
  transactions: Transaction[];
  report: UnderwritingReport | null;
  underwriting_actions: UnderwritingAction[];
};

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw || !raw.trim()) {
    throw new ApiError(
      "The backend URL is not configured. Set NEXT_PUBLIC_API_URL.",
      0,
    );
  }
  return raw.replace(/\/+$/, "");
}

function networkFailure(): ApiError {
  return new ApiError(
    "Could not reach the Flume backend. Check your connection and try again.",
    0,
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (Array.isArray(detail)) {
        const parts = detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "msg" in item) {
              return String((item as { msg: unknown }).msg);
            }
            return "";
          })
          .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
      }
    }
  } catch {
    // Response was not JSON; fall through to a status-based message.
  }

  if (response.status >= 500) {
    return "The server encountered an error. Please try again.";
  }
  return `Request failed (${response.status}).`;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  parse: (data: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw networkFailure();
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("The backend returned a malformed response.", response.status);
  }

  try {
    return parse(data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("The backend returned an unexpected response.", response.status);
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseApplication(data: unknown): Application {
  if (!data || typeof data !== "object") {
    throw new ApiError("The backend returned an unexpected application record.", 200);
  }
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) {
    throw new ApiError("The backend did not return an application id.", 200);
  }
  if (typeof row.merchant_name !== "string") {
    throw new ApiError("The backend returned an unexpected application record.", 200);
  }
  return {
    id: row.id,
    merchant_name: row.merchant_name,
    status: asString(row.status, "PENDING"),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function parseTransaction(data: unknown): Transaction | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const amount = asNumber(row.amount);
  const confidence = asNumber(row.confidence);
  if (amount === null || confidence === null) return null;
  const date = asString(row.transaction_date) || asString(row.date);
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    document_id: typeof row.document_id === "string" ? row.document_id : undefined,
    vendor: asString(row.vendor, "Unknown vendor"),
    transaction_date: date,
    amount,
    category: asString(row.category, "Uncategorized"),
    confidence,
  };
}

function parseReport(data: unknown): UnderwritingReport | null {
  if (data == null) return null;
  if (typeof data !== "object") {
    throw new ApiError("The backend returned an unexpected report.", 200);
  }
  const row = data as Record<string, unknown>;
  const totalRevenue = asNumber(row.total_revenue);
  const totalExpenses = asNumber(row.total_expenses);
  const expenseRatio = asNumber(row.expense_ratio);
  const averageOrderValue = asNumber(row.average_order_value);
  if (
    totalRevenue === null ||
    totalExpenses === null ||
    expenseRatio === null ||
    averageOrderValue === null
  ) {
    throw new ApiError("The backend returned an unexpected report.", 200);
  }
  return {
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    expense_ratio: expenseRatio,
    average_order_value: averageOrderValue,
    risk_level: asString(row.risk_level, "UNKNOWN"),
    summary: asString(row.summary),
  };
}

function parseAction(data: unknown): UnderwritingAction | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    agent_name: asString(row.agent_name) || undefined,
    action: asString(row.action) || undefined,
    reason: asString(row.reason) || undefined,
    previous_status: typeof row.previous_status === "string" ? row.previous_status : null,
    new_status: typeof row.new_status === "string" ? row.new_status : null,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function parseApplicationReport(data: unknown): ApplicationReport {
  if (!data || typeof data !== "object") {
    throw new ApiError("The backend returned an unexpected report payload.", 200);
  }
  const row = data as Record<string, unknown>;
  const transactions = Array.isArray(row.transactions)
    ? row.transactions.map(parseTransaction).filter((tx): tx is Transaction => tx !== null)
    : [];
  const actions = Array.isArray(row.underwriting_actions)
    ? row.underwriting_actions.map(parseAction).filter((item): item is UnderwritingAction => item !== null)
    : [];
  return {
    application: parseApplication(row.application),
    transactions,
    report: parseReport(row.report),
    underwriting_actions: actions,
  };
}

function fileForUpload(file: File): File {
  if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "text/csv") {
    return file;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return new File([file], file.name, { type: "text/csv" });
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return new File([file], file.name, { type: "image/jpeg" });
  }
  if (name.endsWith(".png")) return new File([file], file.name, { type: "image/png" });
  return file;
}

export async function createApplication(merchantName: string): Promise<Application> {
  return requestJson(
    "/applications",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_name: merchantName }),
    },
    parseApplication,
  );
}

export async function uploadDocument(applicationId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", fileForUpload(file));

  let response: Response;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/applications/${encodeURIComponent(applicationId)}/documents`,
      { method: "POST", body: form },
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw networkFailure();
  }

  if (!response.ok) {
    throw new ApiError(
      `Could not upload "${file.name}": ${await readErrorMessage(response)}`,
      response.status,
    );
  }
}

export async function processApplication(applicationId: string): Promise<void> {
  await requestJson(
    `/applications/${encodeURIComponent(applicationId)}/process`,
    { method: "POST" },
    () => undefined,
  );
}

export async function getApplicationReport(applicationId: string): Promise<ApplicationReport> {
  return requestJson(
    `/applications/${encodeURIComponent(applicationId)}/report`,
    { method: "GET" },
    parseApplicationReport,
  );
}
