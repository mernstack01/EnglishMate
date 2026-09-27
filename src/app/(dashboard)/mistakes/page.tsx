import type { Metadata } from "next";
import { ModuleEmptyState } from "@/features/learning/module-empty-state";
export const metadata: Metadata = { title: "Mistakes" };
export default function Page() {
  return <ModuleEmptyState module="mistakes" />;
}
