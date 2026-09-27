import type { Metadata } from "next";
import { SynonymNavigation } from "@/features/synonyms/components/synonym-navigation";

export const metadata: Metadata = { title: "Synonym notebook" };

export default function SynonymLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-7">
      <SynonymNavigation />
      {children}
    </div>
  );
}
