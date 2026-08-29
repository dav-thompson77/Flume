"""Intake agent (FLUME.md section 14).

Converts one uploaded financial record (receipt image or CSV) into
structured transactions using MiniMax, validates them, and stores them
in Supabase. This is a plain function, not an agent framework - the
orchestration (fetch -> download -> ask MiniMax -> validate -> insert)
is all explicit here, matching the "Python is responsible for
controlled execution" split in FLUME.md section 3.
"""

import base64
import csv
import io
import json
import re

from minimax_client import call_minimax_chat
from supabase_client import get_supabase_client

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

EXTRACTION_INSTRUCTIONS = """You are extracting structured financial transaction data from a \
merchant financial record.

Return ONLY a JSON array. Do not return markdown. \
Do not return explanatory text outside the JSON array.

Each transaction must contain:
- vendor
- date
- amount
- category
- confidence

Rules:
- amount must be a number.
- confidence must be between 0 and 1.
- Do not invent transactions.
- If information is unclear, use a lower confidence value.
- If no transactions can be reliably identified, return an empty array."""

STRICT_RETRY_SUFFIX = (
    "\n\nYour previous response was not a valid JSON array. "
    "Respond again with ONLY the JSON array and nothing else."
)


class IntakeError(Exception):
    """Raised when a document cannot be turned into transactions."""


def run_intake_agent(application_id: str, document_id: str) -> list[dict]:
    """Extract transactions from one uploaded document and store them.

    If transactions already exist for this document, they are returned
    as-is instead of calling MiniMax and inserting again (FLUME.md
    section 3 - simple idempotency, no dedup infrastructure).

    Args:
        application_id: The application the document belongs to.
        document_id: The document to process.

    Returns:
        The transaction rows for this document (freshly inserted, or
        the ones already stored from a previous run).

    Raises:
        IntakeError: The document couldn't be found/downloaded, its
            file type isn't supported, or MiniMax never returned a
            usable JSON array.
        MiniMaxError: The MiniMax request itself failed.
    """
    client = get_supabase_client()

    existing = client.table("transactions").select("*").eq("document_id", document_id).execute()
    if existing.data:
        return existing.data

    doc_result = (
        client.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("application_id", application_id)
        .execute()
    )
    if not doc_result.data:
        raise IntakeError(f"Document {document_id} not found for application {application_id}")

    document = doc_result.data[0]
    mime_type = document["mime_type"]

    try:
        file_bytes = client.storage.from_("receipts").download(document["storage_path"])
    except Exception as exc:
        raise IntakeError("Could not download document from storage") from exc

    if mime_type in IMAGE_MIME_TYPES:
        message_content = _build_image_message(file_bytes, mime_type)
    elif mime_type == "text/csv":
        message_content = _build_csv_message(file_bytes)
    else:
        raise IntakeError(f"Unsupported document type for intake: {mime_type}")

    raw_transactions = _extract_with_minimax(message_content)
    valid_transactions = _validate_transactions(raw_transactions)

    if not valid_transactions:
        return []

    rows = [
        {
            "document_id": document_id,
            "vendor": tx["vendor"],
            "transaction_date": tx["date"],
            "amount": tx["amount"],
            "category": tx["category"],
            "confidence": tx["confidence"],
        }
        for tx in valid_transactions
    ]

    insert_result = client.table("transactions").insert(rows).execute()
    return insert_result.data


def _build_image_message(file_bytes: bytes, mime_type: str) -> list[dict]:
    """Build an OpenAI-style multimodal message for a receipt image."""
    encoded = base64.b64encode(file_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{encoded}"
    return [
        {"type": "text", "text": EXTRACTION_INSTRUCTIONS},
        {"type": "image_url", "image_url": {"url": data_url}},
    ]


def _build_csv_message(file_bytes: bytes) -> str:
    """Build a text prompt for a CSV file, using the built-in csv module.

    Different merchants export CSVs with different column names, so the
    raw rows are handed to MiniMax as text and the model is asked to
    infer the mapping, rather than assuming one exact column layout.
    """
    text = file_bytes.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))

    if not rows:
        raise IntakeError("CSV file is empty")

    table_text = "\n".join(",".join(cell for cell in row) for row in rows)

    return (
        f"{EXTRACTION_INSTRUCTIONS}\n\n"
        "The financial record below is a CSV export. Column names vary between "
        "merchants - infer reasonable mappings from common fields such as date, "
        "transaction_date, amount, total, vendor, merchant, description, and "
        "category. If the CSV cannot be meaningfully interpreted, return an "
        "empty array rather than inventing transactions.\n\n"
        f"CSV contents:\n{table_text}"
    )


def _extract_with_minimax(message_content: list[dict] | str) -> list:
    """Call MiniMax and parse a JSON array from the reply, retrying once."""
    reply = call_minimax_chat(message_content)
    parsed = _parse_json_array(reply)
    if parsed is not None:
        return parsed

    if isinstance(message_content, str):
        retry_content = message_content + STRICT_RETRY_SUFFIX
    else:
        retry_content = [*message_content, {"type": "text", "text": STRICT_RETRY_SUFFIX}]

    retry_reply = call_minimax_chat(retry_content)
    parsed = _parse_json_array(retry_reply)
    if parsed is not None:
        return parsed

    raise IntakeError("MiniMax did not return a valid JSON array after one retry")


def _parse_json_array(text: str) -> list | None:
    """Try to parse `text` as a JSON array, tolerating stray markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, list) else None


def _validate_transactions(raw_transactions: list) -> list[dict]:
    """Keep only the transactions that have every required field in the right shape.

    Rules (FLUME.md section 14 / task Part 6):
        vendor, date, category -> non-empty strings
        amount, confidence     -> numbers, with confidence in [0, 1]
    Anything else is silently dropped rather than partially inserted.
    """
    valid = []
    for item in raw_transactions:
        if not isinstance(item, dict):
            continue

        vendor = item.get("vendor")
        date = item.get("date")
        amount = item.get("amount")
        category = item.get("category")
        confidence = item.get("confidence")

        if not isinstance(vendor, str) or not vendor.strip():
            continue
        if not isinstance(date, str) or not date.strip():
            continue
        if not isinstance(category, str) or not category.strip():
            continue
        if not isinstance(amount, (int, float)) or isinstance(amount, bool):
            continue
        if not isinstance(confidence, (int, float)) or isinstance(confidence, bool):
            continue
        if not (0 <= confidence <= 1):
            continue

        valid.append(
            {
                "vendor": vendor.strip(),
                "date": date.strip(),
                "amount": float(amount),
                "category": category.strip(),
                "confidence": float(confidence),
            }
        )

    return valid
