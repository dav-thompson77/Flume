# Flume

A Next.js frontend + FastAPI backend project.

- `frontend/` — Next.js app, deployed to [Vercel](https://vercel.com).
- `backend/` — FastAPI service, deployed to [Railway](https://railway.app).

See [`FLUME.md`](./FLUME.md) for the full architecture overview, environment variables, and
deployment instructions.

## Quickstart

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload

# Frontend (in a separate terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000 (frontend) and http://localhost:8000/docs (backend API docs).
