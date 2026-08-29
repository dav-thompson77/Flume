"""Minimal MiniMax API client for the Flume backend.

A single function that calls MiniMax's OpenAI-compatible Chat Completions
endpoint directly with `requests` - no SDK, no agent framework (FLUME.md
section 3: Python calls MiniMax directly and stays in control).

Reference: https://platform.minimax.io/docs/api-reference/text-chat-openai
(verified before writing this file - endpoint, auth header, model name,
and multimodal `image_url` content-part format all come from there).
"""

import os

import requests

MINIMAX_BASE_URL = "https://api.minimax.io/v1"
MINIMAX_CHAT_MODEL = "MiniMax-M3"  # the only current MiniMax model with image/video understanding
REQUEST_TIMEOUT_SECONDS = 60


class MiniMaxError(Exception):
    """Raised when a MiniMax request fails or MiniMax reports an error."""


def call_minimax_chat(content: list[dict] | str) -> str:
    """Send one user message to MiniMax and return the model's reply text.

    Args:
        content: Either a plain text string, or a list of OpenAI-style
            content parts (e.g. `{"type": "text", ...}` and
            `{"type": "image_url", ...}`) for multimodal input.

    Returns:
        The model's final reply text. "Thinking" is explicitly disabled
        in the request, so this is just the answer - not a `<think>`
        reasoning block.

    Raises:
        MiniMaxError: If `MINIMAX_API_KEY` is missing, the request
            fails/times out, or MiniMax's response indicates an error.
    """
    api_key = os.getenv("MINIMAX_API_KEY")
    if not api_key:
        raise MiniMaxError("MINIMAX_API_KEY is not set.")

    payload = {
        "model": MINIMAX_CHAT_MODEL,
        "messages": [{"role": "user", "content": content}],
        # We want a direct answer we can parse as JSON, not a reasoning trace.
        "thinking": {"type": "disabled"},
        "max_completion_tokens": 2000,
    }

    try:
        response = requests.post(
            f"{MINIMAX_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise MiniMaxError(f"Could not reach MiniMax: {exc}") from exc

    if response.status_code != 200:
        raise MiniMaxError(f"MiniMax returned HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError as exc:
        raise MiniMaxError("MiniMax returned a response that was not valid JSON") from exc

    # MiniMax can report an error inside an HTTP 200 response via `base_resp`.
    base_resp = data.get("base_resp") or {}
    if base_resp.get("status_code", 0) != 0:
        raise MiniMaxError(f"MiniMax error: {base_resp.get('status_msg', 'unknown error')}")

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise MiniMaxError("MiniMax response did not contain a message") from exc
