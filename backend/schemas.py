"""Pydantic request/response models for the Flume API.

Kept separate from `main.py` purely so the route handlers stay short and
readable. There is no validation/business logic here beyond what
Pydantic does automatically from the type hints.
"""

from pydantic import BaseModel


class ApplicationCreate(BaseModel):
    merchant_name: str


class ApplicationOut(BaseModel):
    id: str
    merchant_name: str
    status: str
    created_at: str


class DocumentOut(BaseModel):
    id: str
    application_id: str
    file_name: str
    storage_path: str
    mime_type: str


class TransactionOut(BaseModel):
    id: str
    document_id: str
    vendor: str
    transaction_date: str
    amount: float
    category: str
    confidence: float


class UnderwritingResult(BaseModel):
    application_id: str
    total_revenue: float
    total_expenses: float
    expense_ratio: float
    average_order_value: float
    risk_level: str
    previous_status: str | None
    new_status: str | None
    reason: str
    summary: str


class ProcessResult(BaseModel):
    application_id: str
    documents_processed: int
    transactions_extracted: int
    transactions: list[TransactionOut]
    underwriting: UnderwritingResult


class ApplicationReportOut(BaseModel):
    application: dict
    transactions: list[dict]
    report: dict | None
    underwriting_actions: list[dict]
