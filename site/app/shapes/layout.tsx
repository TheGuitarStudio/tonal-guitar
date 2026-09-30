import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/home-layout";
import { baseOptions } from "../layout.config";
// Shared shape-library-ui components (spec §7 D-003 vertical slice) ship
// their own plain `tg-`-prefixed stylesheet driven by `--tg-*` custom
// properties. Only `/shapes` renders them, so it loads here rather than in
// the root layout. It lands after `../global.css`, which is fine: the
// package's defaults use `:where(:root)`, so the site's `--tg-*` mapping in
// `global.css` wins regardless of order.
import "shape-library-ui/src/styles.css";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}
