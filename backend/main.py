"""FastAPI application entrypoint for the Flume backend.

This is the Stage 2 foundation only: a health check, CORS for the
deployed frontend, and a global error handler. The application,
upload, transaction, underwriting, review, and report endpoints
described in FLUME.md (sections 13 and 23) are built in later stages.
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="Flume API")

# CORS: allow the deployed frontend (from the FRONTEND_URL environment
# variable) plus common local dev origins, so `npm run dev` keeps working
# without needing its own env var. Intentionally never "*" - the API is
# meant to be called by the Flume frontend, not by arbitrary origins.
FRONTEND_URL = os.getenv("FRONTEND_URL")

DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

allow_origins = list(DEV_ORIGINS)
if FRONTEND_URL and FRONTEND_URL not in allow_origins:
    allow_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a clean JSON error instead of leaking a traceback to the client."""
    logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by Railway's healthcheck and for local verification."""
    return {"status": "ok"}
