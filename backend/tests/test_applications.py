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
