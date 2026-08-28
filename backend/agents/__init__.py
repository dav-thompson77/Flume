"""Flume's agent modules.

This is not an agent framework - just two workflow functions described
in FLUME.md (sections 13-15):

- `intake.extract_transactions`: turns an uploaded financial record
  into structured transactions using MiniMax.
- `underwriting.generate_recommendation`: turns structured transactions
  into an AI-assisted underwriting recommendation.

Neither is implemented yet; both are placeholders for a later backend
stage. Business logic (validation, financial calculations, deterministic
rules, database writes) stays in the FastAPI endpoints that call these
functions, not inside the agents themselves (FLUME.md section 3).
"""
