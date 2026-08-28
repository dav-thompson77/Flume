# Flume Frontend

Next.js app for Flume, deployed to [Vercel](https://vercel.com).

## Stack

- [Next.js](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Project layout

```
frontend/
├── src/
│   ├── app/            # App Router pages, layouts & global styles
│   ├── components/     # Reusable UI components
│   ├── lib/             # Client utilities (e.g. API fetch wrapper)
│   └── types/           # Shared TypeScript types (e.g. API response shapes)
├── public/               # Static assets
├── .env.example
├── next.config.ts
└── vercel.json
```

## Local development

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The app expects the FastAPI backend to be running
(see `../backend/README.md`) and reachable at `NEXT_PUBLIC_API_URL`.

## Scripts

```bash
npm run dev      # Start the dev server
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # Run ESLint
```

## Deploying to Vercel

1. Import this repository into Vercel.
2. Set the project's **Root Directory** to `frontend`.
3. Vercel auto-detects the Next.js framework preset (also declared in `vercel.json`).
4. Add the environment variables from `.env.example` under
   Project Settings > Environment Variables (set `NEXT_PUBLIC_API_URL` to your
   deployed Railway backend URL).
5. Push to your production branch — Vercel builds and deploys automatically.
