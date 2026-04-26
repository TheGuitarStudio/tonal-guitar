import { notFound } from "next/navigation";
import { ShapeEditor } from "./components/ShapeEditor";

export const metadata = {
  title: "Shape Editor (Admin)",
};

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Shape Editor</h1>
        <p className="text-sm text-fd-muted-foreground">
          Local-development tool for creating and fixing scale/chord shapes.
          Double-click empty cells to add notes, double-click notes to remove
          them. Use “Set root” then click a note to mark it as the root.
        </p>
      </header>
      <ShapeEditor />
    </main>
  );
}
