"""Tests for run_underwriting_agent with a mocked Supabase client.

No real credentials are required. The fake client stores rows in memory
so we can check status changes, audit records, reports, and idempotency.
"""

from unittest.mock import patch

import pytest

from agents.underwriting import UnderwritingError, _insert_audit_record, run_underwriting_agent


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """Minimal stand-in for supabase.table(...).select().eq().execute()."""

    def __init__(self, table_name: str, store: dict):
        self._table_name = table_name
        self._store = store
        self._rows = list(store.setdefault(table_name, []))
        self._insert_rows = None
        self._update_values = None
        self._order_key = None
        self._order_desc = False
        self._limit = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column: str, value):
        self._rows = [row for row in self._rows if row.get(column) == value]
        return self

    def in_(self, column: str, values):
        self._rows = [row for row in self._rows if row.get(column) in values]
        return self

    def order(self, column: str, *, desc: bool = False):
        self._order_key = column
        self._order_desc = desc
        return self

    def limit(self, size: int):
        self._limit = size
        return self

    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        self._insert_rows = rows
        return self

    def update(self, values):
        self._update_values = values
        return self

    def execute(self):
        if self._insert_rows is not None:
            inserted = []
            for row in self._insert_rows:
                stored = dict(row)
                next_id = len(self._store[self._table_name]) + 1
                stored.setdefault("id", f"{self._table_name}-{next_id}")
                stored.setdefault("created_at", "2026-08-29T00:00:00Z")
                self._store[self._table_name].append(stored)
                inserted.append(stored)
            return FakeResult(inserted)

        if self._update_values is not None:
            for row in self._rows:
                row.update(self._update_values)
            return FakeResult(list(self._rows))

        rows = list(self._rows)
        if self._order_key:
            rows.sort(
                key=lambda row: row.get(self._order_key) or "",
                reverse=self._order_desc,
            )
        if self._limit is not None:
            rows = rows[: self._limit]
        return FakeResult(rows)


class FakeClient:
    def __init__(self, store: dict):
        self.store = store

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, self.store)


def _store_with_transactions(transactions: list[dict], status: str = "PENDING") -> dict:
    return {
        "applications": [
            {
                "id": "app-1",
                "merchant_name": "Island Grocers",
                "status": status,
                "created_at": "2026-08-01T00:00:00Z",
            }
        ],
        "documents": [{"id": "doc-1", "application_id": "app-1"}],
        "transactions": [
            {"id": f"tx-{index}", "document_id": "doc-1", **tx}
            for index, tx in enumerate(transactions, start=1)
        ],
        "underwriting_actions": [],
        "reports": [],
    }


@patch("agents.underwriting.get_supabase_client")
def test_agent_writes_status_audit_and_report(mock_get_client) -> None:
    store = _store_with_transactions(
        [
            {"amount": 12500.0, "confidence": 0.95},
            {"amount": -8000.0, "confidence": 0.90},
        ]
    )
    mock_get_client.return_value = FakeClient(store)

    result = run_underwriting_agent("app-1")

    assert result["new_status"] == "CLEAR_FOR_REVIEW"
    assert result["previous_status"] == "PENDING"
    assert result["risk_level"] == "LOW"
    assert result["total_revenue"] == 12500.0
    assert result["total_expenses"] == 8000.0
    assert store["applications"][0]["status"] == "CLEAR_FOR_REVIEW"
    assert len(store["underwriting_actions"]) == 1
    action = store["underwriting_actions"][0]
    assert "agent_name" not in action
    assert action["application_id"] == "app-1"
    assert action["actor_type"] == "ai"
    assert action["action"] == "status_change"
    assert action["previous_status"] == "PENDING"
    assert action["new_status"] == "CLEAR_FOR_REVIEW"
    assert len(store["reports"]) == 1
    assert "12,500" in result["summary"]
    assert "8,000" in result["summary"]


@patch("agents.underwriting.get_supabase_client")
def test_agent_is_idempotent_when_a_report_already_exists(mock_get_client) -> None:
    store = _store_with_transactions(
        [
            {"amount": 1000.0, "confidence": 0.95},
            {"amount": -200.0, "confidence": 0.90},
        ],
        status="CLEAR_FOR_REVIEW",
    )
    store["reports"] = [
        {
            "id": "report-1",
            "application_id": "app-1",
            "total_revenue": 1000.0,
            "total_expenses": 200.0,
            "expense_ratio": 0.2,
            "average_order_value": 1000.0,
            "risk_level": "LOW",
            "summary": "Existing summary.",
            "created_at": "2026-08-29T00:00:00Z",
        }
    ]
    store["underwriting_actions"] = [
        {
            "id": "action-1",
            "application_id": "app-1",
            "action": "status_change",
            "reason": "Already processed.",
            "previous_status": "PENDING",
            "new_status": "CLEAR_FOR_REVIEW",
            "created_at": "2026-08-29T00:00:00Z",
        }
    ]
    mock_get_client.return_value = FakeClient(store)

    result = run_underwriting_agent("app-1")

    assert result["summary"] == "Existing summary."
    assert result["previous_status"] == "PENDING"
    assert result["new_status"] == "CLEAR_FOR_REVIEW"
    assert len(store["reports"]) == 1
    assert len(store["underwriting_actions"]) == 1
    assert store["applications"][0]["status"] == "CLEAR_FOR_REVIEW"


@patch("agents.underwriting.get_supabase_client")
def test_agent_rejects_missing_application(mock_get_client) -> None:
    mock_get_client.return_value = FakeClient(
        {
            "applications": [],
            "documents": [],
            "transactions": [],
            "underwriting_actions": [],
            "reports": [],
        }
    )

    with pytest.raises(UnderwritingError, match="Application not found"):
        run_underwriting_agent("missing")


@patch("agents.underwriting.get_supabase_client")
def test_agent_rejects_application_with_no_transactions(mock_get_client) -> None:
    mock_get_client.return_value = FakeClient(
        {
            "applications": [{"id": "app-1", "status": "PENDING"}],
            "documents": [{"id": "doc-1", "application_id": "app-1"}],
            "transactions": [],
            "underwriting_actions": [],
            "reports": [],
        }
    )

    with pytest.raises(UnderwritingError, match="no transactions"):
        run_underwriting_agent("app-1")


def test_audit_insert_supplies_non_null_actor_type() -> None:
    store = {"underwriting_actions": []}
    _insert_audit_record(
        FakeClient(store),
        application_id="app-1",
        reason="Expenses exceed the 85% threshold.",
        previous_status="PENDING",
        new_status="HOLD",
    )

    assert len(store["underwriting_actions"]) == 1
    row = store["underwriting_actions"][0]
    assert row["actor_type"] is not None
    assert row["actor_type"] == "ai"
    assert "agent_name" not in row
    assert "actor_id" not in row
    assert row["application_id"] == "app-1"
    assert row["action"] == "status_change"
    assert row["previous_status"] == "PENDING"
    assert row["new_status"] == "HOLD"
