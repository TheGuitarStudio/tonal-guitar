export default function HomePage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center text-center">
      <h1 className="mb-4 text-3xl font-bold">tonal-guitar</h1>
      <p className="mb-8 text-fd-muted-foreground">
        Guitar fretboard, shapes, patterns, and sequences — built on Tonal.js
      </p>
      <a
        href="/experiments"
        className="rounded-md bg-fd-primary px-6 py-2.5 text-fd-primary-foreground transition-opacity hover:opacity-90"
      >
        Open Guitar Lab
      </a>
    </main>
  );
}
