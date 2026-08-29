"""Tests for POST /applications/{id}/decision."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
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


def _store_ready_for_decision(*, human_decision=None, status="CLEAR_FOR_REVIEW") -> dict:
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
            {"id": "tx-1", "document_id": "doc-1", "amount": 12500.0, "confidence": 0.95},
            {"id": "tx-2", "document_id": "doc-1", "amount": -8000.0, "confidence": 0.90},
        ],
        "reports": [
            {
                "id": "report-1",
                "application_id": "app-1",
                "total_revenue": 12500.0,
                "total_expenses": 8000.0,
                "expense_ratio": 0.64,
                "average_order_value": 12500.0,
                "risk_level": "LOW",
                "ai_recommendation": "CLEAR_FOR_REVIEW",
                "ai_summary": "Revenue totaled $12,500 with $8,000 in expenses.",
                "human_decision": human_decision,
                "created_at": "2026-08-29T00:00:00Z",
            }
        ],
        "underwriting_actions": [
            {
                "id": "action-1",
                "application_id": "app-1",
                "actor_type": "ai",
                "actor_name": "Underwriting Agent",
                "action": "status_change",
                "reason": (
                    "The financial metrics and extraction confidence passed the MVP rules."
                ),
                "previous_status": "PENDING",
                "new_status": "CLEAR_FOR_REVIEW",
                "created_at": "2026-08-29T00:00:00Z",
            }
        ],
    }


def _patch_clients(mock_main, mock_agent, store: dict) -> FakeClient:
    fake = FakeClient(store)
    mock_main.return_value = fake
    mock_agent.return_value = fake
    return fake


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_approve_saves_human_decision(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision()
    _patch_clients(mock_main, mock_agent, store)

    response = client.post("/applications/app-1/decision", json={"decision": "APPROVE"})

    assert response.status_code == 200
    body = response.json()
    assert body["human_decision"] == "APPROVE"
    assert body["previous_status"] == "CLEAR_FOR_REVIEW"
    assert body["new_status"] == "APPROVED"
    assert body["status"] == "APPROVED"
    assert store["reports"][0]["human_decision"] == "APPROVE"
    assert store["reports"][0]["ai_recommendation"] == "CLEAR_FOR_REVIEW"
    assert store["applications"][0]["status"] == "APPROVED"


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_request_more_review_saves_human_decision(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision()
    _patch_clients(mock_main, mock_agent, store)

    response = client.post(
        "/applications/app-1/decision", json={"decision": "REQUEST_MORE_REVIEW"}
    )

    assert response.status_code == 200
    assert response.json()["human_decision"] == "REQUEST_MORE_REVIEW"
    assert response.json()["new_status"] == "REQUEST_MORE_REVIEW"
    assert store["reports"][0]["human_decision"] == "REQUEST_MORE_REVIEW"
    assert store["applications"][0]["status"] == "REQUEST_MORE_REVIEW"


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_reject_saves_human_decision(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision()
    _patch_clients(mock_main, mock_agent, store)

    response = client.post("/applications/app-1/decision", json={"decision": "REJECT"})

    assert response.status_code == 200
    assert response.json()["human_decision"] == "REJECT"
    assert response.json()["new_status"] == "REJECTED"
    assert store["reports"][0]["human_decision"] == "REJECT"
    assert store["applications"][0]["status"] == "REJECTED"


def test_invalid_decision_is_rejected() -> None:
    response = client.post("/applications/app-1/decision", json={"decision": "HOLD"})

    assert response.status_code == 400
    assert "APPROVE" in response.json()["detail"]


@patch("main.get_supabase_client")
def test_missing_application_is_not_found(mock_main) -> None:
    mock_main.return_value = FakeClient(
        {
            "applications": [],
            "documents": [],
            "transactions": [],
            "underwriting_actions": [],
            "reports": [],
        }
    )

    response = client.post("/applications/missing/decision", json={"decision": "APPROVE"})

    assert response.status_code == 404


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_missing_report_is_rejected(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision()
    store["reports"] = []
    _patch_clients(mock_main, mock_agent, store)

    response = client.post("/applications/app-1/decision", json={"decision": "APPROVE"})

    assert response.status_code == 400
    assert "report" in response.json()["detail"].lower()


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_human_audit_record_is_created(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision()
    _patch_clients(mock_main, mock_agent, store)

    response = client.post("/applications/app-1/decision", json={"decision": "APPROVE"})

    assert response.status_code == 200
    assert len(store["underwriting_actions"]) == 2
    human = store["underwriting_actions"][1]
    payload_keys = set(human.keys()) - {"id", "created_at"}
    assert payload_keys == {
        "application_id",
        "actor_type",
        "actor_name",
        "action",
        "reason",
        "previous_status",
        "new_status",
    }
    assert human["actor_type"] == "human"
    assert human["actor_name"] == "Bank Reviewer"
    assert human["action"] == "human_decision"
    assert human["previous_status"] == "CLEAR_FOR_REVIEW"
    assert human["new_status"] == "APPROVED"
    assert human["reason"] == "The bank reviewer approved this application."
    assert human["actor_type"] != "ai"


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_existing_human_decision_is_not_overwritten(mock_main, mock_agent) -> None:
    store = _store_ready_for_decision(human_decision="APPROVE", status="APPROVED")
    store["underwriting_actions"].append(
        {
            "id": "action-2",
            "application_id": "app-1",
            "actor_type": "human",
            "actor_name": "Bank Reviewer",
            "action": "human_decision",
            "reason": "The bank reviewer approved this application.",
            "previous_status": "CLEAR_FOR_REVIEW",
            "new_status": "APPROVED",
            "created_at": "2026-08-29T01:00:00Z",
        }
    )
    _patch_clients(mock_main, mock_agent, store)

    response = client.post("/applications/app-1/decision", json={"decision": "REJECT"})

    assert response.status_code == 409
    assert "already" in response.json()["detail"].lower()
    assert store["reports"][0]["human_decision"] == "APPROVE"
    assert store["applications"][0]["status"] == "APPROVED"
    assert len(store["underwriting_actions"]) == 2
    assert store["underwriting_actions"][1]["actor_type"] == "human"
    assert store["underwriting_actions"][1]["new_status"] == "APPROVED"


@patch("agents.underwriting.get_supabase_client")
@patch("main.get_supabase_client")
def test_application_status_updates_for_each_decision(mock_main, mock_agent) -> None:
    expected = {
        "APPROVE": "APPROVED",
        "REQUEST_MORE_REVIEW": "REQUEST_MORE_REVIEW",
        "REJECT": "REJECTED",
    }
    for decision, status in expected.items():
        store = _store_ready_for_decision()
        _patch_clients(mock_main, mock_agent, store)
        response = client.post("/applications/app-1/decision", json={"decision": decision})
        assert response.status_code == 200
        assert store["applications"][0]["status"] == status
        assert response.json()["status"] == status


@patch("agents.underwriting.get_supabase_client")
def test_ai_underwriting_audit_behavior_is_unchanged(mock_get_client) -> None:
    from agents.underwriting import run_underwriting_agent

    store = {
        "applications": [
            {
                "id": "app-1",
                "merchant_name": "Island Grocers",
                "status": "PENDING",
                "created_at": "2026-08-01T00:00:00Z",
            }
        ],
        "documents": [{"id": "doc-1", "application_id": "app-1"}],
        "transactions": [
            {"id": "tx-1", "document_id": "doc-1", "amount": 12500.0, "confidence": 0.95},
            {"id": "tx-2", "document_id": "doc-1", "amount": -8000.0, "confidence": 0.90},
        ],
        "underwriting_actions": [],
        "reports": [],
    }
    mock_get_client.return_value = FakeClient(store)

    result = run_underwriting_agent("app-1")

    assert result["new_status"] == "CLEAR_FOR_REVIEW"
    assert len(store["underwriting_actions"]) == 1
    action = store["underwriting_actions"][0]
    assert action["actor_type"] == "ai"
    assert action["actor_name"] == "Underwriting Agent"
    assert action["action"] == "status_change"
    assert "human_decision" not in store["reports"][0]
    assert store["reports"][0]["ai_recommendation"] == "CLEAR_FOR_REVIEW"
