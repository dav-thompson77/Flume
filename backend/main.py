"""FastAPI application entrypoint for the Flume backend.

Backend Stage 2: application creation, document upload, and AI intake
(FLUME.md sections 13-14, 22-23). Underwriting, human review status
changes, and the report endpoint are built in a later stage.
"""

import logging
import os
import re
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agents.intake import IntakeError, run_intake_agent
from minimax_client import MiniMaxError
from schemas import ApplicationCreate, ApplicationOut, DocumentOut, ProcessResult
from supabase_client import get_supabase_client

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


# --- Document upload constraints (Part 2) -----------------------------------

ALLOWED_DOCUMENT_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "text/csv"}
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _safe_filename(original_filename: str | None) -> str:
    """Turn an arbitrary uploaded filename into a safe storage-path component.

    We never trust the original filename as a storage path - it could
    contain "../", slashes, or other characters that don't belong in one.
    """
    name = os.path.basename(original_filename or "file")
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name)
    return name or "file"


def _get_application_or_404(client, application_id: str) -> dict:
    """Look up an application by id, or raise a 404."""
    try:
        result = client.table("applications").select("id").eq("id", application_id).execute()
    except Exception:
        result = None

    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    return result.data[0]


@app.post("/applications", response_model=ApplicationOut, status_code=201)
def create_application(payload: ApplicationCreate) -> dict:
    """Create a new underwriting application (Part 1)."""
    merchant_name = payload.merchant_name.strip()
    if not merchant_name:
        raise HTTPException(status_code=400, detail="merchant_name must not be empty")

    client = get_supabase_client()

    try:
        result = (
            client.table("applications")
            .insert({"merchant_name": merchant_name, "status": "PENDING"})
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to create application")
        raise HTTPException(status_code=500, detail="Failed to create application") from exc

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application")

    return result.data[0]


@app.post("/applications/{application_id}/documents", response_model=DocumentOut, status_code=201)
def upload_document(application_id: str, file: UploadFile = File(...)) -> dict:
    """Upload one financial record file for an application (Part 2).

    Called once per file - the frontend loops over its selected files and
    calls this endpoint for each one.
    """
    client = get_supabase_client()
    _get_application_or_404(client, application_id)

    mime_type = file.content_type
    if mime_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {mime_type}. "
            f"Allowed types: {', '.join(sorted(ALLOWED_DOCUMENT_MIME_TYPES))}",
        )

    contents = file.file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(contents) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds the 10 MB size limit")

    storage_path = f"{application_id}/{uuid.uuid4()}-{_safe_filename(file.filename)}"

    try:
        client.storage.from_("receipts").upload(
            storage_path,
            contents,
            {"content-type": mime_type, "upsert": "false"},
        )
    except Exception as exc:
        logger.exception("Failed to upload document to storage")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage") from exc

    try:
        result = (
            client.table("documents")
            .insert(
                {
                    "application_id": application_id,
                    "file_name": file.filename or "file",
                    "storage_path": storage_path,
                    "mime_type": mime_type,
                }
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to save document record")
        raise HTTPException(status_code=500, detail="Failed to save document record") from exc

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save document record")

    return result.data[0]


@app.post("/applications/{application_id}/process", response_model=ProcessResult)
def process_application(application_id: str) -> dict:
    """Run AI intake for every document on an application (Part 8).

    This stage performs intake only - extracting and storing
    transactions. It does not run underwriting or change the
    application's status; that's Backend Stage 3.
    """
    client = get_supabase_client()
    _get_application_or_404(client, application_id)

    docs_result = (
        client.table("documents").select("*").eq("application_id", application_id).execute()
    )
    documents = docs_result.data or []

    if not documents:
        raise HTTPException(status_code=400, detail="Application has no uploaded documents")

    all_transactions: list[dict] = []
    for document in documents:
        try:
            transactions = run_intake_agent(application_id, document["id"])
        except MiniMaxError as exc:
            logger.exception("MiniMax request failed for document %s", document["id"])
            raise HTTPException(status_code=502, detail="MiniMax request failed") from exc
        except IntakeError as exc:
            logger.exception("Could not process document %s", document["id"])
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("Unexpected error processing document %s", document["id"])
            raise HTTPException(
                status_code=500, detail="Unexpected error processing documents"
            ) from exc

        all_transactions.extend(transactions)

    return {
        "application_id": application_id,
        "documents_processed": len(documents),
        "transactions_extracted": len(all_transactions),
        "transactions": all_transactions,
    }
