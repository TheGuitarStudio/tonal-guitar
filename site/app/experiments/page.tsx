import { PipelineBuilder } from "./components/PipelineBuilder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guitar Lab - Tonal",
  description:
    "Interactive guitar fretboard experiments — compose shapes, patterns, and sequences",
};

export default function ExperimentsPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Guitar Lab</h1>
        <p className="mt-2 text-fd-muted-foreground">
          Build guitar exercises by composing shapes, patterns, and sequences.
          Each step feeds into the next — change any parameter and see results
          update live.
        </p>
      </div>
      <PipelineBuilder />
    </main>
  );
}
