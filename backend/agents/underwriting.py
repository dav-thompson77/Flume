"""Underwriting agent (FLUME.md section 15).

Purpose: analyze extracted transactions and produce an AI-assisted
underwriting recommendation.

Planned workflow:
    1. Calculate financial metrics from the transactions (Python, not
       the LLM - see FLUME.md section 16).
    2. Ask MiniMax to evaluate financial risk.
    3. Validate the AI response.
    4. Apply deterministic rules (FLUME.md section 18).
    5. Update application state and record an audit event.

Expected recommendation shape: risk_level, risk_flags, recommendation,
explanation.

Not implemented yet - this module only establishes where that logic
will live in a later stage.
"""


def generate_recommendation(transactions: list[dict]) -> dict:
    """Produce an AI-assisted underwriting recommendation.

    Args:
        transactions: Structured transactions produced by the intake
            agent.

    Returns:
        A recommendation dict with risk_level/risk_flags/
        recommendation/explanation.

    Raises:
        NotImplementedError: The underwriting agent has not been
            implemented yet.
    """
    raise NotImplementedError("Underwriting agent is not implemented yet.")
