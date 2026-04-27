"use client";

import { useState } from "react";
import { generateCode, type CodeGenInput } from "./codeGen";

interface CodePreviewProps extends CodeGenInput {}

export function CodePreview(props: CodePreviewProps) {
  const { code } = generateCode(props);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-fd-muted-foreground">
          Live TypeScript that reproduces the current pipeline. Updates as you
          change any option above.
        </p>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-fd-border px-3 py-1 text-xs transition-colors hover:bg-fd-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-fd-muted p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
