# Flume 💳

### AI-Assisted Financial Underwriting for Caribbean MSMEs

Flume turns messy merchant financial records into a structured financial profile and underwriting recommendation, helping lenders review small businesses faster.

---

## The Problem

Many Caribbean MSMEs generate real revenue but struggle to access formal credit because their financial history is scattered across POS exports, receipts, and other unstructured records.

Reviewing this information manually is slow and makes it difficult for lenders to quickly assess a business's financial position.

---

## Solution

Flume lets a lender upload financial records through a web portal.

An **Intake Agent** uses AI to extract transactions from uploaded records, including CSV files and receipt images. An **Underwriting Agent** then calculates financial metrics, evaluates risk using defined MVP rules, and produces a structured recommendation for human review.

A lender can review the extracted transactions, financial metrics, AI recommendation, risk assessment, and audit trail before recording a final human decision.

---

## Features

* Upload multiple financial documents for one application
* Extract transactions from CSV files and receipt images
* Calculate revenue, expenses, expense ratio, and average order value
* Generate AI-assisted underwriting recommendations
* Identify high-risk financial patterns
* Review extracted transactions and confidence scores
* Human-in-the-loop approve, request more review, or reject decisions
* Record AI and human actions in an audit trail
* Generate a final underwriting report

---

## Tech Stack

| Layer      | Technologies                      |
| ---------- | --------------------------------- |
| Frontend   | Next.js, TypeScript, Tailwind CSS |
| Backend    | FastAPI, Python                   |
| Database   | Supabase Postgres                 |
| Storage    | Supabase Storage                  |
| AI         | MiniMax API                       |
| Deployment | Vercel + Railway                  |

---

## Getting Started

### Prerequisites

* Node.js & npm
* Python 3.12+
* Supabase project
* MiniMax API key

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Environment Variables

**Frontend**

```env
NEXT_PUBLIC_API_URL=your_backend_url
```

**Backend**

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
MINIMAX_API_KEY=your_minimax_api_key
```

---

## Workflow

```text
Lender uploads financial records
              ↓
         Intake Agent
              ↓
     Extracted transactions
              ↓
      Underwriting Agent
              ↓
 Financial metrics + risk assessment
              ↓
        Human review
              ↓
Approve / Request More Review / Reject
              ↓
       Underwriting Report
```

---

## MVP Scope

Flume is an AI-assisted underwriting prototype built for the Future Caribbean Global Agentic Buildathon.

The MVP focuses on turning unstructured merchant financial records into structured evidence that a human reviewer can use to make a faster, more informed underwriting decision.

Human review remains the final decision point.
