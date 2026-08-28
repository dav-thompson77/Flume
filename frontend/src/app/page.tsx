// Temporary placeholder confirming the design-system foundation is wired
// up (Urbanist font + Flume color tokens). The real Upload page (FLUME.md
// section 9) replaces this in a later step.

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Flume</h1>
      <p className="text-base font-medium text-foreground-secondary">Design system ready.</p>
    </main>
  );
}
