import { RootProvider } from "fumadocs-ui/provider";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
// Shared shape-library-ui components (spec §7 D-003 vertical slice) ship
// their own plain stylesheet, `tg-`-prefixed and driven by CSS custom
// properties — no Tailwind/Fumadocs class names inside it. Import it before
// `./global.css` so the Fumadocs-token mapping appended there (a later
// `:root { --tg-* }` block) wins the cascade for same-specificity `:root`
// rules regardless of light/dark mode.
import "shape-library-ui/src/styles.css";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider search={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
