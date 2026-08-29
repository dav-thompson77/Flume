"""FastAPI application entrypoint for the Flume backend.

Backend MVP: application creation, document upload, AI intake,
underwriting, and human review decisions (FLUME.md sections 13-23).
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
from agents.underwriting import (
    HUMAN_DECISIONS,
    HumanDecisionExistsError,
    UnderwritingError,
    report_row_for_api,
    run_underwriting_agent,
    submit_human_decision,
)
from minimax_client import MiniMaxError
from schemas import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationReportOut,
    DocumentOut,
    HumanDecisionCreate,
    HumanDecisionOut,
    ProcessResult,
)
from supabase_client import get_supabase_client

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="Flume API")

# CORS: allow the deployed Vercel frontend and common local Next.js origins.
# FRONTEND_URL can still add another origin without a code change.
# Intentionally never "*": the API is meant to be called by the Flume frontend.
PRODUCTION_FRONTEND_ORIGIN = "https://flume-rosy.vercel.app"
DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

allow_origins = [PRODUCTION_FRONTEND_ORIGIN, *DEV_ORIGINS]
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
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
        result = client.table("applications").select("*").eq("id", application_id).execute()
    except Exception:
        result = None

    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    return result.data[0]


def _http_for_underwriting_error(exc: UnderwritingError) -> HTTPException:
    """Map underwriting errors to a client-safe HTTP status."""
    message = str(exc)
    lowered = message.lower()
    if "not found" in lowered:
        status_code = 404
    elif "database error" in lowered:
        status_code = 500
    else:
        status_code = 400
    return HTTPException(status_code=status_code, detail=message)


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
    """Run AI intake, then underwriting, for an application.

    1. Extract and store transactions for every uploaded document.
    2. Run `run_underwriting_agent` once for the application.

    Intake already skips MiniMax when a document already has
    transactions. Underwriting returns the existing report instead of
    writing a duplicate status change when the application was already
    processed.
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

    try:
        underwriting = run_underwriting_agent(application_id)
    except UnderwritingError as exc:
        logger.exception("Underwriting failed for application %s", application_id)
        raise _http_for_underwriting_error(exc) from exc

    return {
        "application_id": application_id,
        "documents_processed": len(documents),
        "transactions_extracted": len(all_transactions),
        "transactions": all_transactions,
        "underwriting": underwriting,
    }


@app.get("/applications/{application_id}/report", response_model=ApplicationReportOut)
def get_application_report(application_id: str) -> dict:
    """Return the application, transactions, latest report, and audit trail.

    If underwriting has not run yet, `report` is null rather than a
    fabricated object. Audit rows are returned in chronological order.
    """
    client = get_supabase_client()
    application = _get_application_or_404(client, application_id)

    try:
        docs_result = (
            client.table("documents").select("id").eq("application_id", application_id).execute()
        )
        doc_ids = [doc["id"] for doc in (docs_result.data or []) if doc.get("id")]

        if doc_ids:
            txs_result = (
                client.table("transactions").select("*").in_("document_id", doc_ids).execute()
            )
            transactions = txs_result.data or []
        else:
            transactions = []

        reports_result = (
            client.table("reports")
            .select("*")
            .eq("application_id", application_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        report = report_row_for_api(reports_result.data[0] if reports_result.data else None)

        actions_result = (
            client.table("underwriting_actions")
            .select("*")
            .eq("application_id", application_id)
            .order("created_at")
            .execute()
        )
        underwriting_actions = actions_result.data or []
    except Exception as exc:
        logger.exception("Failed to load report for application %s", application_id)
        raise HTTPException(status_code=500, detail="Failed to load application report") from exc

    return {
        "application": application,
        "transactions": transactions,
        "report": report,
        "underwriting_actions": underwriting_actions,
    }


@app.post("/applications/{application_id}/decision", response_model=HumanDecisionOut)
def record_application_decision(application_id: str, payload: HumanDecisionCreate) -> dict:
    """Record the bank reviewer's final decision for an application.

    Persists reports.human_decision, updates applications.status, and
    writes a human underwriting_actions row. Does not overwrite an
    existing human decision.
    """
    if payload.decision not in HUMAN_DECISIONS:
        raise HTTPException(
            status_code=400,
            detail="decision must be one of: APPROVE, REQUEST_MORE_REVIEW, REJECT",
        )

    _get_application_or_404(get_supabase_client(), application_id)

    try:
        return submit_human_decision(application_id, payload.decision)
    except HumanDecisionExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UnderwritingError as exc:
        raise _http_for_underwriting_error(exc) from exc
