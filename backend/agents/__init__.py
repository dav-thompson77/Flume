"""Flume's agent modules.

This is not an agent framework - just two workflow functions described
in FLUME.md (sections 13-15):

- `intake.run_intake_agent`: turns an uploaded financial record into
  structured transactions using MiniMax.
- `underwriting.run_underwriting_agent`: calculates metrics, applies
  deterministic rules, updates application status, and writes the audit
  trail and report.
"""
