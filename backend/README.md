# Flume Backend

FastAPI service that powers the Flume API. Deployed to [Railway](https://railway.app).

This covers the backend MVP in `FLUME.md`: application creation, document upload, AI intake
(MiniMax extracts transactions from an uploaded receipt/CSV, which get validated and stored in
Supabase), and underwriting (Python calculates metrics, applies deterministic rules, updates
status, and writes the audit trail and report).

## Stack

- [FastAPI](https://fastapi.tiangolo.com/)
- [Uvicorn](https://www.uvicorn.org/) (ASGI server)
- [Supabase](https://supabase.com/) Python client (database + private file storage)
- [MiniMax](https://platform.minimax.io/docs/api-reference/text-chat-openai) `MiniMax-M3`, called
  directly over HTTP with `requests` (no SDK, no agent framework)

## API

| Method | Path                                    | Purpose                                             |
| ------ | ---------------------------------------- | ---------------------------------------------------- |
| GET    | `/health`                                  | Liveness check                                       |
| POST   | `/applications`                             | Create an application (`{"merchant_name": "..."}`)   |
| POST   | `/applications/{application_id}/documents`   | Upload one file (JPEG/PNG/WEBP/CSV, ≤10 MB)          |
| POST   | `/applications/{application_id}/process`      | Run AI intake, then underwriting                     |
| GET    | `/applications/{application_id}/report`       | Application, transactions, latest report, audit trail |

See `main.py` for full request/response shapes (also available live at `/docs`).

## Project layout

```
backend/
├── main.py                 # FastAPI app, CORS, error handler, all routes
├── schemas.py                # Pydantic request/response models
├── supabase_client.py          # get_supabase_client() - shared client
├── minimax_client.py             # call_minimax_chat() - raw HTTP call to MiniMax
├── agents/
│   ├── __init__.py
│   ├── intake.py                  # run_intake_agent() - document -> transactions
│   └── underwriting.py             # run_underwriting_agent() - metrics, rules, status, audit, report
├── tests/
├── requirements.txt            # Production dependencies
├── requirements-dev.txt         # Dev/test dependencies (superset of requirements.txt)
├── .env.example
├── railway.json                  # Railway build/deploy configuration
└── Procfile                       # Fallback start command (also works on Heroku-style PaaS)
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                     | Required for            | Notes                                              |
| ----------------------------- | ------------------------ | --------------------------------------------------- |
| `FRONTEND_URL`                 | CORS                      | Public URL of the deployed frontend                  |
| `SUPABASE_URL`                  | All endpoints below `/health` | From your Supabase project settings             |
| `SUPABASE_SERVICE_ROLE_KEY`      | All endpoints below `/health` | Server-side only - never expose to the browser  |
| `MINIMAX_API_KEY`                 | `/applications/{id}/process`  | From your MiniMax API key settings              |
| `PORT`                              | Local dev only            | Railway injects this automatically in production   |

Never commit a real `.env` file or real secret values.

## Local development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env

uvicorn main:app --reload
```

The API will be available at http://localhost:8000, with interactive docs at
http://localhost:8000/docs.

`FRONTEND_URL` can be left blank for local development - `http://localhost:3000` and
`http://127.0.0.1:3000` are always allowed by CORS regardless of that setting.

## Testing `/health`

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{ "status": "ok" }
```

## Trying the other endpoints

```bash
# Create an application
curl -X POST http://localhost:8000/applications \
  -H "Content-Type: application/json" \
  -d '{"merchant_name": "Island Grocers"}'

# Upload a document (repeat once per file)
curl -X POST http://localhost:8000/applications/<application_id>/documents \
  -F "file=@/path/to/receipt.jpg;type=image/jpeg"

# Run AI intake, then underwriting
curl -X POST http://localhost:8000/applications/<application_id>/process

# Fetch the underwriting report and audit trail
curl http://localhost:8000/applications/<application_id>/report
```

The upload and process endpoints need real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (and
`MINIMAX_API_KEY` for processing) set in `.env` - they'll fail with a clear error otherwise.

## Testing & linting

```bash
pytest
ruff check .
```

## Deploying to Railway

1. Create a new Railway project and link this repository.
2. Set the service's **Root Directory** to `backend`.
3. Railway auto-detects Python via Nixpacks and installs `requirements.txt`.
4. The start command is defined in `railway.json` / `Procfile`:
   `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Copy the variables from `.env.example` into the Railway service's **Variables** tab
   (set `FRONTEND_URL` to your deployed Vercel URL).
6. Railway automatically injects `PORT`; no extra config is needed.
