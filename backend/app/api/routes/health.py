"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Simple liveness/readiness probe used by Railway and uptime checks."""

    return {"status": "ok"}
