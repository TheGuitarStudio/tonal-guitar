import { HomeLayout } from "fumadocs-ui/home-layout";
import { baseOptions } from "../layout.config";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}
