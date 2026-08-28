# FLUME — Project Context

This document is the **source of truth** for the Flume project. It is referenced at every step
of implementation. Build features piece by piece, in the order requested, against this spec.

## 1. Project Overview

Flume is an AI-powered B2B credit-underwriting assistant for Caribbean MSMEs.

The primary user is a **bank employee / credit analyst**, not the merchant.

A bank worker uploads a merchant's financial records, such as:

* Receipt photos
* POS records
* CSV transaction records

Flume processes those records and helps the bank worker evaluate the merchant's financial health.

The core workflow is:

```text
Bank Worker
    ↓
Upload Financial Records
    ↓
AI Intake
    ↓
Transaction Extraction
    ↓
Validation
    ↓
Financial Analysis
    ↓
AI Risk Assessment
    ↓
Human Review
    ↓
Human Decision
    ↓
Application Status Update
    ↓
Audit Trail
    ↓
Underwriting Report
```

Flume is an **AI-assisted underwriting workflow**.

It is NOT intended to autonomously approve or reject real loans.

---

## 2. MVP Philosophy

This is a hackathon MVP, not a production banking platform.

The system should be:

* Simple
* Understandable
* Demonstrable
* End-to-end
* Visually polished
* Easy to explain

The developer should be able to explain every major part of the system.

Do not introduce complexity merely to make the system appear more advanced.

Prefer:

```text
simple working implementation
```

over:

```text
complex architecture with unnecessary infrastructure
```

The MVP should demonstrate the core idea clearly rather than attempt to solve every problem involved in real-world banking.

---

## 3. What "Agentic" Means in Flume

Flume uses a **lightweight agentic workflow**.

There is no separate agent runtime or agent framework.

The system combines:

```text
MiniMax
+
Python orchestration
+
controlled system actions
+
human review
```

### MiniMax is responsible for AI work

MiniMax handles tasks that require AI understanding or judgment, including:

* Understanding receipt/document images
* Extracting transactions
* Interpreting financial patterns
* Identifying potential risks
* Producing explanations and summaries

### Python is responsible for controlled execution

Python/FastAPI handles:

* Calling MiniMax
* Validating AI output
* Calculating financial metrics
* Applying deterministic business rules
* Reading/writing Supabase data
* Updating application state
* Creating audit records
* Controlling the workflow

### Human reviewer is the final decision-maker

The bank worker reviews the AI-generated evidence and recommendation and makes the final decision.

Therefore:

```text
MiniMax
    ↓
AI understanding / judgment

Python
    ↓
Orchestration / calculations / validation / actions

Human
    ↓
Final underwriting decision
```

This separation is intentional.

Do NOT move all business logic into the LLM.

Do NOT allow the LLM to arbitrarily execute database operations.

Do NOT build a complex autonomous agent framework.

---

## 4. Why This Is Agentic

Flume is not simply:

```text
Upload → Ask AI for a paragraph → Display paragraph
```

Instead, the AI participates in a multi-step workflow.

Example:

```text
Receipt
   ↓
MiniMax extracts transactions
   ↓
Python validates extracted data
   ↓
Python calculates financial metrics
   ↓
MiniMax evaluates financial risks
   ↓
Python combines AI assessment with deterministic rules
   ↓
AI recommendation generated
   ↓
Human reviews evidence
   ↓
Human makes decision
   ↓
Python updates application status
   ↓
Python records audit event
```

The system therefore performs actions based on intermediate results and changes the state of an underwriting application.

This is the agentic behavior we want to demonstrate.

---

## 5. Human-in-the-Loop

Human review is a core feature, not an afterthought.

The AI should NOT make the final lending decision.

The AI provides:

* Extracted data
* Financial metrics
* Risk flags
* Risk assessment
* Recommendation
* Explanation

The bank worker reviews these outputs.

The bank worker then makes the final decision.

The interface must clearly distinguish:

```text
AI Recommendation
```

from:

```text
Human Decision
```

Never represent an AI recommendation as an actual loan approval or rejection.

---

## 6. Target User

The target user is a:

* Bank credit analyst
* Loan officer
* Financial institution employee
* Underwriting reviewer

The merchant does not directly use the MVP.

The merchant's financial records are the input.

---

## 7. MVP User Journey

The complete user experience should be:

```text
1. Bank worker opens Flume
        ↓
2. Enters merchant name
        ↓
3. Uploads financial record
        ↓
4. Starts analysis
        ↓
5. Flume processes the document
        ↓
6. Flume extracts transactions
        ↓
7. Flume calculates financial metrics
        ↓
8. Flume performs AI risk assessment
        ↓
9. Bank worker reviews results
        ↓
10. Bank worker makes final decision
        ↓
11. Flume records the decision
        ↓
12. Bank worker views final report
```

---

## 8. Frontend Routes

The MVP frontend has four primary pages.

```text
/
```

Upload page.

```text
/processing/[id]
```

Processing page.

```text
/review/[id]
```

Human review page.

```text
/report/[id]
```

Final underwriting report.

---

## 9. Upload Page

Route:

```text
/
```

Purpose:

Allow a bank worker to create an underwriting application.

The page should contain:

* Flume branding
* Page heading
* Short explanation
* Merchant/business name field
* Drag-and-drop upload area
* File picker
* Selected file information
* Remove file option
* Analyze button

Supported MVP files:

* JPG
* JPEG
* PNG
* CSV

Only one file is required for the MVP.

The Analyze button should be disabled until:

* Merchant name is entered
* A file is selected

Initially, the frontend may use a mock application ID because the real backend has not yet been connected.

---

## 10. Processing Page

Route:

```text
/processing/[id]
```

Purpose:

Show the bank worker that Flume is processing the application.

Display a clear sequence:

```text
Upload Complete
        ↓
Extracting Transactions
        ↓
Analyzing Financial Health
        ↓
Preparing AI Risk Assessment
        ↓
Ready for Human Review
```

During frontend development, this can use simulated progress.

Once the backend is connected, the page should represent the actual processing workflow.

Do not fabricate or display hidden AI chain-of-thought.

The UI should show **workflow stages**, not private model reasoning.

---

## 11. Human Review Page

Route:

```text
/review/[id]
```

This is the central page of the MVP.

The bank worker should be able to understand the entire underwriting situation from this page.

### Application Information

Show:

* Merchant name
* Application ID
* Current status

### Financial Snapshot

Show:

* Total Revenue
* Total Expenses
* Expense Ratio
* Average Order Value

### AI Risk Assessment

Show:

* Risk level
* Risk flags
* AI recommendation
* AI explanation

### Transaction Evidence

Display:

| Vendor | Date | Amount | Category | Confidence |
| ------ | ---- | ------ | -------- | ---------- |

The reviewer should be able to inspect the underlying transactions that produced the analysis.

### Human Decision

Provide clear decision options.

For the MVP:

```text
Clear for Review
Request More Information
Place on Hold
```

The exact status names may be adjusted during implementation, but the key distinction must remain:

```text
AI Recommendation ≠ Human Decision
```

The reviewer should confirm the final decision.

---

## 12. Final Report Page

Route:

```text
/report/[id]
```

The report should present the completed underwriting analysis in a professional format.

Include:

### Application

* Merchant name
* Application ID
* Final status
* Review date

### Financial Health

* Total Revenue
* Total Expenses
* Expense Ratio
* Average Order Value

### AI Recommendation

Show:

* Risk level
* Recommendation
* Risk flags
* Explanation

### Human Decision

Clearly display:

* Reviewer's final decision
* Final application status

### Transactions

Show the extracted transactions.

### Audit Trail

Show important events chronologically.

Example:

```text
Application Created
        ↓
Financial Records Uploaded
        ↓
Transactions Extracted
        ↓
Financial Analysis Completed
        ↓
AI Risk Assessment Completed
        ↓
Human Review Completed
        ↓
Application Status Updated
```

Events should identify the actor when appropriate:

```text
Flume AI
Bank Reviewer
System
```

### AI Summary

Display a short plain-English summary of the financial analysis.

---

## 13. Backend Architecture

The backend should remain intentionally small.

Preferred structure:

```text
backend/
├── main.py
├── supabase_client.py
├── agents/
│   ├── intake.py
│   └── underwriting.py
├── requirements.txt
└── .env.example
```

The `agents/` directory represents logical workflow components.

It is NOT an agent framework.

---

## 14. Intake Agent

File:

```text
backend/agents/intake.py
```

Purpose:

Convert uploaded financial records into structured transactions.

Workflow:

```text
Uploaded document
        ↓
Python sends document to MiniMax
        ↓
MiniMax understands document
        ↓
MiniMax returns structured transaction data
        ↓
Python validates response
        ↓
Python stores transactions in Supabase
```

Expected transaction structure:

```text
vendor
date
amount
category
confidence
```

The `confidence` value represents the AI's estimated confidence in the extraction.

If MiniMax returns invalid structured data, the backend should handle the error gracefully.

A simple retry is acceptable.

Do not build complex retry infrastructure.

---

## 15. Underwriting Agent

File:

```text
backend/agents/underwriting.py
```

Purpose:

Analyze the extracted transactions and produce an AI-assisted underwriting recommendation.

Workflow:

```text
Transactions
    ↓
Python calculates financial metrics
    ↓
Python prepares financial context
    ↓
MiniMax evaluates financial risks
    ↓
Python validates AI response
    ↓
Python applies deterministic rules
    ↓
Recommendation generated
    ↓
Application state updated
    ↓
Audit event recorded
```

---

## 16. Financial Metrics

The MVP should calculate:

```text
total_revenue
total_expenses
expense_ratio
average_order_value
```

These calculations should be performed by Python, not the LLM.

Example:

```text
expense_ratio = total_expenses / total_revenue
```

The backend should handle edge cases such as zero revenue safely.

---

## 17. AI Risk Assessment

MiniMax should receive the relevant financial information and be asked to identify:

* Potential financial risks
* Positive indicators
* Areas requiring reviewer attention
* Overall risk assessment
* Short explanation

The model should return structured data rather than an unstructured paragraph whenever practical.

For example:

```text
risk_level
risk_flags
recommendation
explanation
```

The exact schema can be refined during implementation.

---

## 18. Deterministic Risk Rules

Python should also enforce simple deterministic rules.

Initial example:

```text
expense_ratio > 0.85
    → HOLD

any transaction confidence < 0.70
    → MANUAL_REVIEW

otherwise
    → CLEAR_FOR_REVIEW
```

These are **demo/MVP rules**.

They are NOT validated lending criteria.

The project documentation and UI should never imply that these thresholds represent real banking policy.

The deterministic rules exist to demonstrate controlled system behavior.

---

## 19. Combining AI and Rules

The underwriting workflow should not blindly trust MiniMax.

Conceptually:

```text
              ┌───────────────┐
              │   MiniMax     │
              │ AI assessment │
              └───────┬───────┘
                      │
                      ▼
              AI risk assessment
                      │
                      │
Transactions ──→ Python ──→ deterministic rules
                      │
                      ▼
              Controlled recommendation
                      │
                      ▼
                Human reviewer
```

The backend should validate the AI response and retain control over application state.

The LLM should not directly update the database.

---

## 20. Application Status

The application represents the underwriting case.

Possible statuses:

```text
PENDING
PROCESSING
AWAITING_REVIEW
CLEAR_FOR_REVIEW
MANUAL_REVIEW
HOLD
```

The exact workflow can be simplified during implementation.

The important requirement is that the application has a real status stored in the database.

The system must demonstrate a real state change.

---

## 21. Audit Trail

Important application actions should be recorded.

An audit event should contain information such as:

```text
application_id
actor
action
reason
previous_status
new_status
timestamp
```

The audit trail should make it possible to understand:

* What happened
* When it happened
* Who/what performed the action
* Why a status changed
* What the previous status was
* What the new status became

This is an MVP audit trail, not a production banking compliance system.

---

## 22. Database

Use Supabase PostgreSQL.

Primary tables:

```text
applications
transactions
underwriting_actions
reports
```

Supabase Storage:

```text
receipts
```

### applications

Represents an underwriting application.

### transactions

Stores extracted financial transactions.

### underwriting_actions

Stores workflow actions and status changes.

### reports

Stores calculated financial metrics, risk information, and summary.

Keep the database schema simple.

Do not introduce another database.

---

## 23. API

The backend should expose only the endpoints required by the MVP.

```text
GET /health

POST /applications

POST /applications/{application_id}/upload

POST /applications/{application_id}/process

GET /applications/{application_id}/report
```

The frontend should communicate with the backend through these endpoints.

Do not create unnecessary APIs.

---

## 24. Deployment Architecture

```text
                    ┌─────────────────┐
                    │     Vercel      │
                    │   Next.js App   │
                    └────────┬────────┘
                             │
                           HTTPS
                             │
                             ▼
                    ┌─────────────────┐
                    │     Railway     │
                    │    FastAPI      │
                    └───────┬─────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
        ┌─────────────────┐   ┌─────────────────┐
        │    Supabase     │   │     MiniMax     │
        │ PostgreSQL +    │   │       AI        │
        │    Storage      │   │                 │
        └─────────────────┘   └─────────────────┘
```

Frontend:

```text
Vercel
```

Backend:

```text
Railway
```

Database + Storage:

```text
Supabase
```

AI:

```text
MiniMax
```

No additional infrastructure is required.

---

## 25. Environment Variables

### Frontend

```text
NEXT_PUBLIC_API_URL=
```

This is the public Railway backend URL.

### Backend

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MINIMAX_API_KEY=
```

Backend secrets must never be exposed to the browser.

Never create public versions of secret keys.

Never commit secrets to GitHub.

---

## 26. Technology Stack

### Frontend

* Next.js
* App Router
* TypeScript
* Tailwind CSS
* Lucide React

### Backend

* FastAPI
* Python

### Database / Storage

* Supabase
* PostgreSQL
* Supabase Storage

### AI

* MiniMax API

### Hosting

* Vercel
* Railway

Do not add additional services unless explicitly approved.

---

## 27. Explicitly Out of Scope

Do NOT build:

* Authentication
* User accounts
* Roles
* Multi-tenancy
* Real bank integrations
* Credit bureau integrations
* Real loan disbursement
* Production credit scoring
* Machine-learning credit models
* Separate agent runtime
* OpenClaw
* Nebius
* LangChain
* CrewAI
* Agent orchestration platforms
* Redis
* Celery
* Kafka
* Vector databases
* RAG
* Kubernetes
* Docker
* Microservices
* Complex observability infrastructure
* Real-time collaboration

If a future production version would require these, that is fine.

They are simply not part of this MVP.

---

## 28. Development Strategy

The project should be developed in stages.

### Stage 1 — Frontend

Build the complete frontend experience using mock data.

Pages:

```text
Upload
    ↓
Processing
    ↓
Human Review
    ↓
Final Report
```

Focus on:

* UX
* visual design
* navigation
* components
* responsive layout
* realistic mock data
* clear distinction between AI and human decisions

Do not connect the backend yet.

### Stage 2 — Backend

Build the FastAPI backend.

Implement:

* health endpoint
* application creation
* file upload
* MiniMax extraction
* transaction storage
* financial calculations
* AI risk assessment
* deterministic rules
* application status
* audit trail
* report endpoint

### Stage 3 — Integration

Connect:

```text
Next.js
    ↓
Railway FastAPI
    ↓
Supabase + MiniMax
```

Replace frontend mock data with real API responses.

### Stage 4 — End-to-End Testing

Test:

```text
Upload
→ Extraction
→ Analysis
→ Risk Assessment
→ Human Review
→ Decision
→ Status Change
→ Audit Trail
→ Report
```

### Stage 5 — Deployment Verification

Verify the deployed:

```text
Vercel frontend
        ↓
Railway backend
        ↓
Supabase
        ↓
MiniMax
```

works as one complete system.

---

## 29. Development Rules for Cursor

Before making changes:

1. Read `FLUME.md`.
2. Inspect the existing project structure.
3. Understand what already exists.
4. Make the smallest change necessary.
5. Do not rewrite working code unnecessarily.
6. Do not introduce new dependencies without approval.
7. Do not introduce new services.
8. Do not change the product scope.
9. Keep implementations understandable.
10. Test each stage before moving to the next.

When multiple approaches are technically valid, choose the simplest approach that works.

Do not optimize for production-scale architecture.

Optimize for:

```text
working
understandable
demonstrable
```

---

## 30. Frontend Design System

### Brand Identity

Flume should feel:

* Modern fintech
* Minimal
* Premium
* AI-first
* Professional
* Trustworthy

Visual inspiration:

* Vercel
* Linear
* Stripe
* Supabase

Avoid:

* Generic AI chatbot aesthetics
* Consumer social-media aesthetics
* Crypto aesthetics
* Excessive gradients
* Excessive animations
* Cluttered dashboards

---

## 31. Typography

Font:

```text
Urbanist
```

Weights:

```text
400 Regular
500 Medium
600 Semibold
700 Bold
800 ExtraBold
```

Use Urbanist throughout the application.

---

## 32. Color Palette

### Background

```text
#060B12
```

Use throughout the application.

No white page backgrounds.

---

### Surface Cards

Preferred:

```text
rgba(30,41,59,0.35)
```

Alternative:

```text
#111827
```

---

### Primary Accent

```text
#10B981
```

Use for:

* Primary buttons
* Icons
* Highlights
* Links
* Charts
* Selected states

---

### Secondary Accent

```text
#34D399
```

Use for:

* Badges
* Success states
* KPI accents
* Positive indicators

---

### Primary Text

```text
#ECFDF5
```

Use for:

* Headings
* Titles
* Important metrics

---

### Secondary Text

```text
#CBD5E1
```

Use for:

* Subtitles
* Descriptions
* Supporting information

---

### Muted Text

```text
#94A3B8
```

Use for:

* Hints
* Metadata
* Less important information
* Table descriptions

---

### Borders

```text
rgba(16,185,129,0.15)
```

Borders should be subtle.

Never use thick borders.

---

## 33. Border Radius

Cards:

```text
14px
```

Buttons:

```text
10px
```

Badges:

```text
40px
```

---

## 34. Shadows

Use soft, large-blur shadows.

Example:

```text
0 30px 60px rgba(0,0,0,0.5)
```

Avoid harsh shadows.

---

## 35. Buttons

### Primary

Background:

```text
#10B981
```

Text:

```text
white
```

Hover:

Slightly brighter.

### Secondary

Transparent background with subtle green outline.

---

## 36. Icons

Use:

```text
Lucide React
```

Use simple line icons.

Icons should communicate meaning rather than exist purely as decoration.

---

## 37. Layout

Maximum content width:

```text
1280px
```

Use generous whitespace.

Preferred spacing:

```text
24px
32px
48px
```

Avoid cramped interfaces.

---

## 38. Cards

Cards should be:

* Dark
* Rounded
* Spacious
* Subtly bordered
* Visually separated from the background

Use hover elevation only when appropriate.

---

## 39. KPI Cards

Use large, easy-to-read financial metrics.

Example:

```text
$23,900
Total Revenue
```

Use green accents where appropriate.

Do not display fake trends or fake percentages.

Only display information supported by the underlying data.

---

## 40. Tables

Use:

* Dark rows
* Light text
* Subtle borders
* Subtle hover states
* No zebra striping

Financial values should be easy to scan.

---

## 41. Animations

Keep animations subtle.

Use:

```text
Fade
Slide Up
```

Duration:

```text
200–300ms
```

Nothing flashy.

Do not use excessive motion.

---

## 42. Responsible AI

Flume is a prototype underwriting assistant.

The project must not claim that its AI or risk rules are validated for real-world lending decisions.

Documentation should acknowledge:

* AI extraction can contain errors.
* AI-generated risk assessments can be incorrect.
* Financial calculations depend on extracted data.
* The MVP risk thresholds are illustrative.
* Human review is required.
* Real institutions would need their own credit policies and compliance processes.

The reviewer must be able to inspect the transaction evidence behind the analysis.

---

## 43. Hackathon Positioning

Flume should be presented as:

> An AI-assisted underwriting workflow that helps Caribbean financial institutions turn messy merchant financial records into structured financial insight and an auditable human-reviewed underwriting decision.

The key innovation is not simply "AI reads receipts."

The complete workflow is:

```text
Messy financial records
        ↓
AI extraction
        ↓
Structured financial data
        ↓
Financial analysis
        ↓
AI risk assessment
        ↓
Human review
        ↓
Controlled status change
        ↓
Auditable decision
```

This demonstrates practical AI coordination rather than a chatbot.

---

## 44. Definition of Done

The MVP is complete when a bank worker can:

```text
1. Enter a merchant
        ↓
2. Upload financial records
        ↓
3. Start an analysis
        ↓
4. See processing stages
        ↓
5. View extracted transactions
        ↓
6. View financial metrics
        ↓
7. View AI risk assessment
        ↓
8. Inspect evidence
        ↓
9. Make a human decision
        ↓
10. See the application status change
        ↓
11. See the audit trail
        ↓
12. View the final underwriting report
```

The application should work end-to-end using:

```text
Next.js
FastAPI
Supabase
MiniMax
Vercel
Railway
```

No additional infrastructure is necessary.
