"""Unit tests for the underwriting metrics and deterministic rules.

These tests cover the MVP decision table (FLUME.md section 18) without
calling Supabase. Agent orchestration with a mocked client lives in
test_run_underwriting_agent.py.
"""

from agents.underwriting import apply_underwriting_rules, calculate_financial_metrics


def test_normal_application_is_clear_for_review() -> None:
    transactions = [
        {"amount": 1000.0, "confidence": 0.95},
        {"amount": -400.0, "confidence": 0.90},
        {"amount": 500.0, "confidence": 0.80},
    ]

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )

    assert metrics["total_revenue"] == 1500.0
    assert metrics["total_expenses"] == 400.0
    assert metrics["expense_ratio"] == 400.0 / 1500.0
    assert metrics["average_order_value"] == 750.0
    assert metrics["expense_ratio"] <= 0.85
    assert decision["status"] == "CLEAR_FOR_REVIEW"
    assert decision["risk_level"] == "LOW"


def test_high_expense_ratio_is_hold() -> None:
    transactions = [
        {"amount": 100.0, "confidence": 0.99},
        {"amount": -90.0, "confidence": 0.99},
    ]

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )

    assert metrics["expense_ratio"] == 0.9
    assert decision["status"] == "HOLD"
    assert decision["risk_level"] == "HIGH"
    assert "85%" in decision["reason"]


def test_low_extraction_confidence_is_manual_review() -> None:
    transactions = [
        {"amount": 1000.0, "confidence": 0.95},
        {"amount": -200.0, "confidence": 0.50},
    ]

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )

    assert metrics["expense_ratio"] < 0.85
    assert decision["status"] == "MANUAL_REVIEW"
    assert decision["risk_level"] == "MEDIUM"
    assert "confidence" in decision["reason"].lower()


def test_high_expense_ratio_takes_priority_over_low_confidence() -> None:
    transactions = [
        {"amount": 100.0, "confidence": 0.40},
        {"amount": -90.0, "confidence": 0.99},
    ]

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )

    assert metrics["expense_ratio"] > 0.85
    assert decision["status"] == "HOLD"
    assert decision["risk_level"] == "HIGH"


def test_zero_revenue_does_not_divide_by_zero() -> None:
    transactions = [
        {"amount": -50.0, "confidence": 0.90},
        {"amount": -25.0, "confidence": 0.80},
    ]

    metrics = calculate_financial_metrics(transactions)
    decision = apply_underwriting_rules(
        transactions,
        total_revenue=metrics["total_revenue"],
        expense_ratio=metrics["expense_ratio"],
    )

    assert metrics["total_revenue"] == 0.0
    assert metrics["total_expenses"] == 75.0
    assert metrics["expense_ratio"] == 0.0
    assert metrics["average_order_value"] == 0.0
    assert decision["status"] == "HOLD"
    assert decision["risk_level"] == "HIGH"
    assert "zero" in decision["reason"].lower()
