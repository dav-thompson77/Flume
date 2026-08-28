# Flume Backend

FastAPI service that powers the Flume API. Deployed to [Railway](https://railway.app).

## Stack

- [FastAPI](https://fastapi.tiangolo.com/)
- [Uvicorn](https://www.uvicorn.org/) (ASGI server)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) for env-based config

## Project layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app instance & startup
│   ├── api/
│   │   ├── router.py         # Aggregates all route modules
│   │   └── routes/
│   │       └── health.py     # GET /health
│   ├── core/
│   │   └── config.py         # Settings loaded from environment variables
│   ├── models/                # ORM / domain models (empty for now)
│   └── schemas/                # Pydantic request/response schemas (empty for now)
├── tests/
│   └── test_health.py
├── requirements.txt           # Production dependencies
├── requirements-dev.txt       # Dev/test dependencies (superset of requirements.txt)
├── .env.example
├── railway.json                # Railway build/deploy configuration
└── Procfile                    # Fallback start command (also works on Heroku-style PaaS)
```

## Local development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env

uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000, with interactive docs at
http://localhost:8000/docs.

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
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Copy the variables from `.env.example` into the Railway service's **Variables** tab
   (set `CORS_ORIGINS` to your deployed frontend URL).
6. Railway automatically injects `PORT`; no extra config is needed.
