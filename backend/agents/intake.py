"""Intake agent (FLUME.md section 14).

Purpose: convert an uploaded financial record (receipt image or CSV)
into structured transactions.

Planned workflow:
    1. Send the uploaded document to MiniMax.
    2. MiniMax returns structured transaction data.
    3. Validate the response.
    4. Store the transactions in Supabase.

Expected transaction shape (per record): vendor, date, amount,
category, confidence.

Not implemented yet - this module only establishes where that logic
will live in a later stage.
"""


def extract_transactions(document) -> list[dict]:
    """Extract structured transactions from an uploaded document.

    Args:
        document: The uploaded financial record (receipt image or CSV).

    Returns:
        A list of transaction dicts, each with vendor/date/amount/
        category/confidence.

    Raises:
        NotImplementedError: The intake agent has not been implemented
            yet.
    """
    raise NotImplementedError("Intake agent is not implemented yet.")
