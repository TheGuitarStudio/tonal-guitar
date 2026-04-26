import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="mb-4 text-3xl font-bold">tonal-guitar</h1>
      <p className="mb-8 text-fd-muted-foreground">
        Guitar fretboard, shapes, patterns, and sequences — built on Tonal.js
      </p>
      <div className="flex gap-3">
        <Link
          href="/docs"
          className="rounded-md border border-fd-border px-6 py-2.5 transition-colors hover:bg-fd-muted"
        >
          Read the docs
        </Link>
        <Link
          href="/experiments"
          className="rounded-md bg-fd-primary px-6 py-2.5 text-fd-primary-foreground transition-opacity hover:opacity-90"
        >
          Open Guitar Lab
        </Link>
      </div>
    </main>
  );
}
