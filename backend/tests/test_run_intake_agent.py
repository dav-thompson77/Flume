"""Tests for the run_intake_agent orchestration, with Supabase and MiniMax
both mocked out (unittest.mock, no new deps). Verifies the wiring - dedup
short-circuit, and the extract -> validate -> insert path for a CSV file.
"""

from unittest.mock import MagicMock, patch

from agents.intake import run_intake_agent


@patch("agents.intake.call_minimax_chat")
@patch("agents.intake.get_supabase_client")
def test_returns_existing_transactions_without_calling_minimax(
    mock_get_client, mock_call_minimax
) -> None:
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
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
    mock_get_client.return_value = fake_client

    result = run_intake_agent("app-1", "doc-1")

    assert len(result) == 1
    assert result[0]["vendor"] == "Island Grocers"
    mock_call_minimax.assert_not_called()


@patch("agents.intake.call_minimax_chat")
@patch("agents.intake.get_supabase_client")
def test_extracts_and_inserts_new_transactions_from_csv(
    mock_get_client, mock_call_minimax
) -> None:
    fake_client = MagicMock()
    transactions_table = MagicMock()
    transactions_table.select.return_value.eq.return_value.execute.return_value.data = []
    transactions_table.insert.return_value.execute.return_value.data = [
        {
            "id": "tx-1",
            "application_id": "app-1",
            "document_id": "doc-1",
            "vendor": "Island Grocers",
            "transaction_date": "2026-08-20",
            "amount": 125.5,
            "category": "sales",
            "confidence": 0.94,
        }
    ]

    def table_side_effect(name):
        table_mock = MagicMock()
        if name == "transactions":
            return transactions_table
        if name == "documents":
            select_chain = table_mock.select.return_value.eq.return_value.eq.return_value
            select_chain.execute.return_value.data = [
                {
                    "id": "doc-1",
                    "application_id": "app-1",
                    "mime_type": "text/csv",
                    "storage_path": "app-1/doc-1-file.csv",
                }
            ]
        return table_mock

    fake_client.table.side_effect = table_side_effect
    fake_client.storage.from_.return_value.download.return_value = (
        b"date,amount,vendor,category\n2026-08-20,125.50,Island Grocers,sales\n"
    )
    mock_get_client.return_value = fake_client

    mock_call_minimax.return_value = (
        '[{"vendor": "Island Grocers", "date": "2026-08-20", '
        '"amount": 125.5, "category": "sales", "confidence": 0.94}]'
    )

    result = run_intake_agent("app-1", "doc-1")

    assert len(result) == 1
    assert result[0]["vendor"] == "Island Grocers"
    mock_call_minimax.assert_called_once()
    # The CSV contents should have been handed to MiniMax as plain text.
    sent_content = mock_call_minimax.call_args[0][0]
    assert isinstance(sent_content, str)
    assert "Island Grocers" in sent_content

    transactions_table.insert.assert_called_once()
    inserted_rows = transactions_table.insert.call_args[0][0]
    assert inserted_rows[0]["application_id"] == "app-1"
    assert inserted_rows[0]["document_id"] == "doc-1"
