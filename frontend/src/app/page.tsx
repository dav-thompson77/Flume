import { ApiStatus } from "@/components/ApiStatus";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-6 dark:from-black dark:to-zinc-950">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 py-32 text-center">
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
          Flume
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Next.js frontend, FastAPI backend.
        </h1>
        <p className="max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          This is the starting point for Flume — a Next.js app deployed on Vercel, backed by a
          FastAPI service deployed on Railway.
        </p>
        <ApiStatus />
      </main>
    </div>
  );
}
