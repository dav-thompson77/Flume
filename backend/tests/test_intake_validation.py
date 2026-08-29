"""Unit tests for the pure parsing/validation helpers in agents/intake.py.

These don't need Supabase or MiniMax - they just check the JSON parsing
and validation rules from FLUME.md section 14 / task Part 6.
"""

from agents.intake import _parse_json_array, _validate_transactions


def test_parse_json_array_plain() -> None:
    assert _parse_json_array('[{"a": 1}]') == [{"a": 1}]


def test_parse_json_array_strips_markdown_fence() -> None:
    text = '```json\n[{"a": 1}]\n```'
    assert _parse_json_array(text) == [{"a": 1}]


def test_parse_json_array_rejects_invalid_json() -> None:
    assert _parse_json_array("not json") is None


def test_parse_json_array_rejects_non_array() -> None:
    assert _parse_json_array('{"a": 1}') is None


def test_validate_transactions_keeps_only_valid_rows() -> None:
    raw = [
        {
            "vendor": "Island Grocers",
            "date": "2026-08-20",
            "amount": 125.5,
            "category": "sales",
            "confidence": 0.94,
        },
        {"vendor": "", "date": "2026-08-20", "amount": 10, "category": "sales", "confidence": 0.5},
        {
            "vendor": "X",
            "date": "2026-08-20",
            "amount": "not-a-number",
            "category": "sales",
            "confidence": 0.5,
        },
        {"vendor": "X", "date": "2026-08-20", "amount": 10, "category": "sales", "confidence": 1.5},
        {"vendor": "X", "amount": 10, "category": "sales", "confidence": 0.5},
        "not-a-dict",
    ]

    result = _validate_transactions(raw)

    assert len(result) == 1
    assert result[0]["vendor"] == "Island Grocers"
    assert result[0]["amount"] == 125.5
