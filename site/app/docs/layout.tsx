import { DocsLayout } from "fumadocs-ui/layout";
import { baseOptions } from "../layout.config";
import { source } from "../source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
