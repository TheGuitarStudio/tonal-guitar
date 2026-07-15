import { ShapeLibrary } from "./components/ShapeLibrary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shape Library - Tonal",
  description:
    "Browse every scale and chord shape in the tonal-guitar registries, with audit results surfaced failures-first.",
};

export default function ShapesPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Shape Library</h1>
        <p className="mt-2 text-fd-muted-foreground">
          Every scale and chord shape in the registries, rendered and audited.
          Failing shapes are sorted to the top so problems are easy to spot
          and report.
        </p>
      </div>
      <ShapeLibrary />
    </main>
  );
}
