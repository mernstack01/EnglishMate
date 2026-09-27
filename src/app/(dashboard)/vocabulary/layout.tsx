import type { Metadata } from "next";
import { VocabularyNavigation } from "@/features/vocabulary/components/navigation";
export const metadata: Metadata = { title: "Vocabulary notebook" };
export default function VocabularyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-7">
      <VocabularyNavigation />
      {children}
    </div>
  );
}
