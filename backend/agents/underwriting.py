"""Underwriting agent (FLUME.md sections 15-21).

Turns stored transactions into financial metrics, a deterministic risk
decision, an application status change, an audit row, and a report.

This is a plain Python function, not an agent framework. MiniMax is not
used here: the MVP risk decision must be easy to audit and explain
(FLUME.md section 18).
"""

import logging

from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

EXPENSE_RATIO_HOLD_THRESHOLD = 0.85
LOW_CONFIDENCE_THRESHOLD = 0.70
# Live underwriting_actions columns (FLUME.md §21 + PostgREST errors, not Python):
# application_id, actor_type, actor_name, action, reason, previous_status, new_status.
# actor_type and actor_name are NOT NULL. Omit actor_id (nullable), agent_name,
# from_status, and to_status (those columns do not exist).
ACTOR_TYPE_AI = "ai"
ACTOR_NAME_UNDERWRITING_AGENT = "Underwriting Agent"

# Verified live reports columns:
# id, application_id, total_revenue, total_expenses, expense_ratio,
# average_order_value, risk_level, ai_recommendation, ai_summary,
# human_decision, created_at.
# Insert ai_recommendation and ai_summary. Omit id, created_at (defaults)
# and human_decision (NULL until a human review endpoint exists).
# Do not send explanation, summary, or a nested metrics object.


class UnderwritingError(Exception):
    """Raised when underwriting cannot produce a valid result."""


def run_underwriting_agent(application_id: str) -> dict:
    """Analyze an application's transactions and record the underwriting result.

    Workflow:
        1. Load the application and its transactions.
        2. If a report already exists, return that result (no duplicate
           status change / audit row / report).
        3. Calculate financial metrics in Python.
        4. Apply the deterministic MVP rules.
        5. Update applications.status.
        6. Insert an underwriting_actions audit row.
        7. Insert a reports row with a short factual summary.

    Args:
        application_id: The application to underwrite.

    Returns:
        A dict with metrics, the status change, the reason, and the summary.

    Raises:
        UnderwritingError: The application is missing, has no transactions,
            has invalid amounts/confidence values, or a database call failed.
    """
    client = get_supabase_client()

    application = _fetch_application(client, application_id)

    existing_report = _fetch_latest_report(client, application_id)
    if existing_report is not None:
        return _result_from_existing(client, application_id, existing_report)

    transactions = _load_transactions(client, application_id)
    if not transactions:
        raise UnderwritingError(
            "Application has no transactions. Run intake before underwriting."
        )

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )
    summary = build_summary(
        total_revenue=metrics["total_revenue"],
        total_expenses=metrics["total_expenses"],
        expense_ratio=metrics["expense_ratio"],
        risk_level=decision["risk_level"],
        new_status=decision["status"],
    )

    previous_status = application.get("status")
    new_status = decision["status"]

    _update_application_status(client, application_id, new_status)
    _insert_audit_record(
        client,
        application_id=application_id,
        reason=decision["reason"],
        previous_status=previous_status,
        new_status=new_status,
    )
    _insert_report(
        client,
        application_id=application_id,
        metrics=metrics,
        risk_level=decision["risk_level"],
        recommendation=new_status,
        summary=summary,
    )

    return {
        "application_id": application_id,
        "total_revenue": metrics["total_revenue"],
        "total_expenses": metrics["total_expenses"],
        "expense_ratio": metrics["expense_ratio"],
        "average_order_value": metrics["average_order_value"],
        "risk_level": decision["risk_level"],
        "previous_status": previous_status,
        "new_status": new_status,
        "reason": decision["reason"],
        "summary": summary,
    }


def calculate_financial_metrics(transactions: list[dict]) -> dict:
    """Calculate the MVP financial metrics from extracted transactions.

    Revenue = sum of positive amounts.
    Expenses = sum of negative amounts, stored as a positive total.
    Expense ratio = total_expenses / total_revenue (0.0 when revenue is 0).
    Average order value = total_revenue / number of revenue transactions.

    Raises:
        UnderwritingError: An amount or confidence value is not numeric.
    """
    total_revenue = 0.0
    total_expenses = 0.0
    revenue_count = 0

    for tx in transactions:
        amount = _as_number(tx.get("amount"), "amount")
        # Validate confidence up front so invalid rows fail even when the
        # expense-ratio rule would have short-circuited the decision.
        _as_number(tx.get("confidence"), "confidence")

        if amount > 0:
            total_revenue += amount
            revenue_count += 1
        elif amount < 0:
            total_expenses += abs(amount)

    if total_revenue == 0:
        expense_ratio = 0.0
        average_order_value = 0.0
    else:
        expense_ratio = total_expenses / total_revenue
        average_order_value = total_revenue / revenue_count

    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "expense_ratio": expense_ratio,
        "average_order_value": average_order_value,
    }


def apply_underwriting_rules(
    transactions: list[dict],
    *,
    total_revenue: float,
    expense_ratio: float,
) -> dict:
    """Apply the MVP status rules in the required order (FLUME.md section 18).

    1. expense_ratio > 0.85           -> HOLD / HIGH
    2. any confidence < 0.70          -> MANUAL_REVIEW / MEDIUM
    3. otherwise                      -> CLEAR_FOR_REVIEW / LOW

    Zero revenue is treated as HOLD so the function never divides by zero
    and never pretends an expense ratio is meaningful without sales.
    """
    if total_revenue == 0:
        return {
            "status": "HOLD",
            "risk_level": "HIGH",
            "reason": (
                "Total revenue is zero, so the expense ratio cannot be calculated. "
                "The application was placed on hold."
            ),
        }

    if expense_ratio > EXPENSE_RATIO_HOLD_THRESHOLD:
        percent = expense_ratio * 100
        return {
            "status": "HOLD",
            "risk_level": "HIGH",
            "reason": (
                "Expenses exceed the 85% threshold "
                f"(expense ratio is {percent:.0f}%)."
            ),
        }

    for tx in transactions:
        confidence = _as_number(tx.get("confidence"), "confidence")
        if confidence < LOW_CONFIDENCE_THRESHOLD:
            return {
                "status": "MANUAL_REVIEW",
                "risk_level": "MEDIUM",
                "reason": (
                    "One or more extracted transactions have low confidence "
                    "(below 0.70)."
                ),
            }

    return {
        "status": "CLEAR_FOR_REVIEW",
        "risk_level": "LOW",
        "reason": (
            "The financial metrics and extraction confidence passed the MVP rules."
        ),
    }


def build_summary(
    *,
    total_revenue: float,
    total_expenses: float,
    expense_ratio: float,
    risk_level: str,
    new_status: str,
) -> str:
    """Build a short factual summary from the calculated metrics. No LLM."""
    ratio_percent = f"{expense_ratio * 100:.0f}"
    sentence = (
        f"Revenue totaled {_format_money(total_revenue)} with "
        f"{_format_money(total_expenses)} in expenses, resulting in an "
        f"expense ratio of {ratio_percent}%."
    )

    if total_revenue == 0:
        follow_up = (
            " Revenue is zero, so automated review could not calculate a "
            "meaningful expense ratio."
        )
    elif new_status == "HOLD" or risk_level == "HIGH":
        follow_up = " Expenses exceed the 85% threshold."
    elif new_status == "MANUAL_REVIEW" or risk_level == "MEDIUM":
        follow_up = (
            " One or more extracted transactions have low confidence and "
            "require manual review."
        )
    else:
        follow_up = " Transaction extraction confidence was sufficient for automated review."

    return f"{sentence}{follow_up}"


def _as_number(value, field_name: str) -> float:
    """Parse a transaction field as a float, rejecting bools and junk data."""
    if isinstance(value, bool) or value is None:
        raise UnderwritingError(
            f"A transaction has an invalid {field_name} and cannot be used "
            "for calculations."
        )
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise UnderwritingError(
            f"A transaction has an invalid {field_name} and cannot be used "
            "for calculations."
        ) from exc
    if number != number:  # NaN
        raise UnderwritingError(
            f"A transaction has an invalid {field_name} and cannot be used "
            "for calculations."
        )
    return number


def _format_money(amount: float) -> str:
    """Format a dollar amount for the summary, matching the spec's style."""
    if abs(amount - round(amount)) < 1e-9:
        return f"${int(round(amount)):,}"
    return f"${amount:,.2f}"


def _execute(query, error_message: str):
    """Run a Supabase query and turn driver errors into UnderwritingError."""
    try:
        return query.execute()
    except UnderwritingError:
        raise
    except Exception as exc:
        logger.exception(error_message)
        raise UnderwritingError(error_message) from exc


def _fetch_application(client, application_id: str) -> dict:
    result = _execute(
        client.table("applications").select("*").eq("id", application_id),
        "A database error occurred while loading the application.",
    )
    if not result.data:
        raise UnderwritingError("Application not found")
    return result.data[0]


def _fetch_latest_report(client, application_id: str) -> dict | None:
    result = _execute(
        client.table("reports")
        .select("*")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1),
        "A database error occurred while loading existing reports.",
    )
    if not result.data:
        return None
    return result.data[0]


def _load_transactions(client, application_id: str) -> list[dict]:
    """Load every transaction for an application via its documents.

    Transactions are stored with document_id (see intake.py), not
    application_id, so we look up the application's documents first.
    """
    docs_result = _execute(
        client.table("documents").select("id").eq("application_id", application_id),
        "A database error occurred while loading documents.",
    )
    doc_ids = [doc["id"] for doc in (docs_result.data or []) if doc.get("id")]
    if not doc_ids:
        return []

    txs_result = _execute(
        client.table("transactions").select("*").in_("document_id", doc_ids),
        "A database error occurred while loading transactions.",
    )
    return txs_result.data or []


def _latest_audit_action(client, application_id: str) -> dict | None:
    result = _execute(
        client.table("underwriting_actions")
        .select("*")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1),
        "A database error occurred while loading underwriting actions.",
    )
    if not result.data:
        return None
    return result.data[0]


def _result_from_existing(client, application_id: str, report: dict) -> dict:
    """Rebuild the agent return value from the stored report and latest audit."""
    action = _latest_audit_action(client, application_id) or {}
    return {
        "application_id": application_id,
        "total_revenue": float(report.get("total_revenue") or 0),
        "total_expenses": float(report.get("total_expenses") or 0),
        "expense_ratio": float(report.get("expense_ratio") or 0),
        "average_order_value": float(report.get("average_order_value") or 0),
        "risk_level": report.get("risk_level"),
        "previous_status": action.get("previous_status"),
        "new_status": action.get("new_status"),
        "reason": action.get("reason") or "",
        "summary": report.get("ai_summary") or "",
    }


def _update_application_status(client, application_id: str, new_status: str) -> None:
    _execute(
        client.table("applications").update({"status": new_status}).eq("id", application_id),
        "A database error occurred while updating the application status.",
    )


def _insert_audit_record(
    client,
    *,
    application_id: str,
    reason: str,
    previous_status: str | None,
    new_status: str,
) -> None:
    row = {
        "application_id": application_id,
        "actor_type": ACTOR_TYPE_AI,
        "actor_name": ACTOR_NAME_UNDERWRITING_AGENT,
        "action": "status_change",
        "reason": reason,
        "previous_status": previous_status,
        "new_status": new_status,
    }
    result = _execute(
        client.table("underwriting_actions").insert(row),
        "A database error occurred while recording the underwriting action.",
    )
    if result.data is None:
        raise UnderwritingError(
            "A database error occurred while recording the underwriting action."
        )


def report_row_for_api(row: dict | None) -> dict | None:
    """Map a reports table row to the GET /report JSON the frontend already reads.

    Database columns stay as-is. The frontend reads `summary` and
    `recommendation`, so copy ai_summary / ai_recommendation there.
    expense_ratio is already the frontend field name.
    """
    if row is None:
        return None
    mapped = dict(row)
    mapped["summary"] = mapped.get("ai_summary") or ""
    mapped["recommendation"] = mapped.get("ai_recommendation") or ""
    return mapped


def _insert_report(
    client,
    *,
    application_id: str,
    metrics: dict,
    risk_level: str,
    recommendation: str,
    summary: str,
) -> None:
    row = {
        "application_id": application_id,
        "total_revenue": metrics["total_revenue"],
        "total_expenses": metrics["total_expenses"],
        "expense_ratio": metrics["expense_ratio"],
        "average_order_value": metrics["average_order_value"],
        "risk_level": risk_level,
        "ai_recommendation": recommendation,
        "ai_summary": summary,
    }
    result = _execute(
        client.table("reports").insert(row),
        "A database error occurred while saving the underwriting report.",
    )
    if result.data is None:
        raise UnderwritingError(
            "A database error occurred while saving the underwriting report."
        )
