# Flume Backend

FastAPI service that powers the Flume API. Deployed to [Railway](https://railway.app).

This is currently a **foundation only** (Stage 2 in `FLUME.md`): a health check, CORS for the
frontend, and a global error handler. The application/upload/transaction/underwriting/report
endpoints, the Supabase queries, and the MiniMax-backed agents are built in later stages.

## Stack

- [FastAPI](https://fastapi.tiangolo.com/)
- [Uvicorn](https://www.uvicorn.org/) (ASGI server)
- [Supabase](https://supabase.com/) Python client (not queried yet - see below)

## Project layout

```
backend/
├── main.py                 # FastAPI app, CORS, health check, global error handler
├── supabase_client.py        # get_supabase_client() - shared client, no queries yet
├── agents/
│   ├── __init__.py
│   ├── intake.py              # Placeholder: will turn uploads into transactions
│   └── underwriting.py         # Placeholder: will turn transactions into a recommendation
├── tests/
│   └── test_health.py
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
| `SUPABASE_URL`                  | Supabase client (unused yet) | From your Supabase project settings               |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase client (unused yet) | Server-side only - never expose to the browser    |
| `MINIMAX_API_KEY`                 | Agents (unused yet)        | Not called anywhere yet                            |
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
