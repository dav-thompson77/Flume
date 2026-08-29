"""Endpoint tests using a mocked Supabase client (unittest.mock, no new deps).

These check input validation and error status codes without needing real
Supabase/MiniMax credentials. Full end-to-end behavior against the real
Supabase project and MiniMax API still needs manual verification.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _make_supabase_mock(applications_data=None, documents_data=None):
    """Fake just enough of client.table(name).select(...).eq(...).execute().data."""
    mock = MagicMock()

    def table_side_effect(name):
        table_mock = MagicMock()
        if name == "applications":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = (
                applications_data or []
            )
        elif name == "documents":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = (
                documents_data or []
            )
        return table_mock

    mock.table.side_effect = table_side_effect
    return mock


def test_create_application_rejects_empty_merchant_name() -> None:
    response = client.post("/applications", json={"merchant_name": "   "})
    assert response.status_code == 400


@patch("main.get_supabase_client")
def test_create_application_success(mock_get_client) -> None:
    fake_client = MagicMock()
    fake_client.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "merchant_name": "Island Grocers",
            "status": "PENDING",
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    mock_get_client.return_value = fake_client

    response = client.post("/applications", json={"merchant_name": "Island Grocers"})

    assert response.status_code == 201
    body = response.json()
    assert body["merchant_name"] == "Island Grocers"
    assert body["status"] == "PENDING"


@patch("main.get_supabase_client")
def test_upload_document_rejects_missing_application(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[])

    response = client.post(
        "/applications/missing-app/documents",
        files={"file": ("receipt.jpg", b"fake-bytes", "image/jpeg")},
    )

    assert response.status_code == 404


@patch("main.get_supabase_client")
def test_upload_document_rejects_unsupported_mime_type(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[{"id": "app-1"}])

    response = client.post(
        "/applications/app-1/documents",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400


@patch("main.get_supabase_client")
def test_upload_document_rejects_oversized_file(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[{"id": "app-1"}])

    too_big = b"0" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/applications/app-1/documents",
        files={"file": ("receipt.jpg", too_big, "image/jpeg")},
    )

    assert response.status_code == 400


@patch("main.get_supabase_client")
def test_upload_document_rejects_empty_file(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[{"id": "app-1"}])

    response = client.post(
        "/applications/app-1/documents",
        files={"file": ("receipt.jpg", b"", "image/jpeg")},
    )

    assert response.status_code == 400


@patch("main.get_supabase_client")
def test_process_requires_application(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[])

    response = client.post("/applications/missing-app/process")

    assert response.status_code == 404


@patch("main.get_supabase_client")
def test_process_requires_at_least_one_document(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(
        applications_data=[{"id": "app-1"}], documents_data=[]
    )

    response = client.post("/applications/app-1/process")

    assert response.status_code == 400


@patch("main.run_underwriting_agent")
@patch("main.run_intake_agent")
@patch("main.get_supabase_client")
def test_process_returns_transactions_and_underwriting(
    mock_get_client, mock_intake, mock_underwriting
) -> None:
    mock_get_client.return_value = _make_supabase_mock(
        applications_data=[{"id": "app-1", "status": "PENDING"}],
        documents_data=[{"id": "doc-1", "application_id": "app-1"}],
    )
    mock_intake.return_value = [
        {
            "id": "tx-1",
            "document_id": "doc-1",
            "vendor": "Island Grocers",
            "transaction_date": "2026-08-20",
            "amount": 125.5,
            "category": "sales",
            "confidence": 0.94,
        }
    ]
    mock_underwriting.return_value = {
        "application_id": "app-1",
        "total_revenue": 125.5,
        "total_expenses": 0.0,
        "expense_ratio": 0.0,
        "average_order_value": 125.5,
        "risk_level": "LOW",
        "previous_status": "PENDING",
        "new_status": "CLEAR_FOR_REVIEW",
        "reason": "The financial metrics and extraction confidence passed the MVP rules.",
        "summary": (
            "Revenue totaled $125.50 with $0 in expenses, "
            "resulting in an expense ratio of 0%."
        ),
    }

    response = client.post("/applications/app-1/process")

    assert response.status_code == 200
    body = response.json()
    assert body["transactions_extracted"] == 1
    assert body["underwriting"]["new_status"] == "CLEAR_FOR_REVIEW"
    mock_underwriting.assert_called_once_with("app-1")


@patch("main.get_supabase_client")
def test_report_requires_application(mock_get_client) -> None:
    mock_get_client.return_value = _make_supabase_mock(applications_data=[])

    response = client.get("/applications/missing-app/report")

    assert response.status_code == 404


@patch("main.get_supabase_client")
def test_report_returns_null_when_underwriting_has_not_run(mock_get_client) -> None:
    fake_client = MagicMock()

    def table_side_effect(name):
        table_mock = MagicMock()
        if name == "applications":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "app-1",
                    "merchant_name": "Island Grocers",
                    "status": "PENDING",
                    "created_at": "2026-08-01T00:00:00Z",
                }
            ]
        elif name == "documents":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = []
        elif name == "reports":
            (
                table_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data
            ) = []
        elif name == "underwriting_actions":
            (
                table_mock.select.return_value.eq.return_value.order.return_value.execute.return_value.data
            ) = []
        return table_mock

    fake_client.table.side_effect = table_side_effect
    mock_get_client.return_value = fake_client

    response = client.get("/applications/app-1/report")

    assert response.status_code == 200
    body = response.json()
    assert body["application"]["id"] == "app-1"
    assert body["transactions"] == []
    assert body["report"] is None
    assert body["underwriting_actions"] == []


@patch("main.get_supabase_client")
def test_report_maps_live_columns_for_frontend(mock_get_client) -> None:
    fake_client = MagicMock()

    def table_side_effect(name):
        table_mock = MagicMock()
        if name == "applications":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "app-1",
                    "merchant_name": "Island Grocers",
                    "status": "CLEAR_FOR_REVIEW",
                    "created_at": "2026-08-01T00:00:00Z",
                }
            ]
        elif name == "documents":
            table_mock.select.return_value.eq.return_value.execute.return_value.data = []
        elif name == "reports":
            (
                table_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data
            ) = [
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
                    "human_decision": None,
                    "created_at": "2026-08-29T00:00:00Z",
                }
            ]
        elif name == "underwriting_actions":
            (
                table_mock.select.return_value.eq.return_value.order.return_value.execute.return_value.data
            ) = []
        return table_mock

    fake_client.table.side_effect = table_side_effect
    mock_get_client.return_value = fake_client

    response = client.get("/applications/app-1/report")

    assert response.status_code == 200
    body = response.json()
    report = body["report"]
    assert report["ai_summary"] == "Revenue totaled $12,500 with $8,000 in expenses."
    assert report["summary"] == "Revenue totaled $12,500 with $8,000 in expenses."
    assert report["ai_recommendation"] == "CLEAR_FOR_REVIEW"
    assert report["recommendation"] == "CLEAR_FOR_REVIEW"
    assert report["expense_ratio"] == 0.64
    assert report["total_revenue"] == 12500.0
    assert report["risk_level"] == "LOW"
