# Flume

Flume is a full-stack web app made up of:

- **`frontend/`** — a [Next.js](https://nextjs.org/) (App Router + TypeScript + Tailwind CSS)
  application, deployed to [Vercel](https://vercel.com).
- **`backend/`** — a [FastAPI](https://fastapi.tiangolo.com/) service, deployed to
  [Railway](https://railway.app).

The two services communicate over HTTP: the frontend calls the backend's REST API using the
`NEXT_PUBLIC_API_URL` environment variable, and the backend allows cross-origin requests from the
frontend's origin via `CORS_ORIGINS`.

## Repository layout

```
flume/
├── frontend/       # Next.js app (Vercel)
├── backend/        # FastAPI app (Railway)
├── FLUME.md        # This file — project/architecture overview
└── README.md       # Top-level quickstart
```

See `frontend/README.md` and `backend/README.md` for service-specific details.

## Architecture

```
┌─────────────────────┐        HTTPS         ┌──────────────────────┐
│   frontend/          │  ───────────────►    │   backend/            │
│   Next.js on Vercel  │   NEXT_PUBLIC_API_URL │   FastAPI on Railway  │
│                       │  ◄───────────────    │                        │
└─────────────────────┘      JSON responses   └──────────────────────┘
```

- The frontend is a static/SSR Next.js app; API calls are made client-side (or from Server
  Components/Route Handlers as needed) through the small fetch wrapper in
  `frontend/src/lib/api.ts`.
- The backend exposes its routes via `backend/app/api/router.py`. `GET /health` is used both by
  the frontend's status indicator and by Railway's healthcheck.

## Local development

Run both services in separate terminals.

**Backend** (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Frontend** (http://localhost:3000):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

With the defaults in each `.env.example`, the frontend at `localhost:3000` will successfully call
the backend at `localhost:8000` (CORS is pre-configured for this).

## Environment variables

| Variable                    | Used by  | Description                                              |
| ---------------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`        | frontend | Base URL of the FastAPI backend                            |
| `APP_NAME`                   | backend  | Display name used in API responses                         |
| `ENVIRONMENT`                | backend  | `development` / `staging` / `production`                   |
| `DEBUG`                      | backend  | Enables verbose FastAPI error responses                    |
| `CORS_ORIGINS`               | backend  | Comma-separated list of origins allowed to call the API    |
| `PORT`                       | backend  | Port Uvicorn binds to (Railway sets this automatically)    |

Never commit real `.env` / `.env.local` files — only the tracked `.env.example` templates.

## Deployment

### Frontend → Vercel

1. Import the repository into Vercel and set **Root Directory** to `frontend`.
2. Vercel auto-detects Next.js (framework config also declared in `frontend/vercel.json`).
3. Set `NEXT_PUBLIC_API_URL` to the deployed Railway backend URL in the Vercel project's
   environment variables.

### Backend → Railway

1. Create a Railway service from this repository and set **Root Directory** to `backend`.
2. Railway builds with Nixpacks using `backend/requirements.txt` and starts the app via
   `backend/railway.json` / `backend/Procfile`
   (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
3. Set the variables from `backend/.env.example` in the Railway service, with `CORS_ORIGINS` set
   to the deployed Vercel frontend URL.

Once both are deployed, update each side's environment variables to point at the other's live
URL and redeploy.
