/**
 * Best-effort clipboard write — the Clipboard API is unavailable in some
 * embeddings (insecure context, permissions denied, non-browser test
 * environments), and a failed copy must never throw or crash the screen.
 * `writeText` rejects asynchronously, so a `try/catch` around it would never
 * see the failure; swallow the rejection with `.catch` instead.
 */
export function copyToClipboard(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {
    // best-effort only
  });
}
