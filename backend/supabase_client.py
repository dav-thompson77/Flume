"""Shared Supabase client for the Flume backend.

Exposes a single reusable client via `get_supabase_client()`, built from
the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
No query, storage, or business logic lives here yet - that belongs to
the endpoints and agents built in later stages (FLUME.md sections 13,
14, 15, 22).
"""

import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


@lru_cache
def get_supabase_client() -> Client:
    """Return a cached Supabase client built from environment variables.

    Raises:
        RuntimeError: If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
            are not set.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the Supabase "
            "client. Copy .env.example to .env and fill in your Supabase project credentials."
        )

    return create_client(supabase_url, supabase_key)
