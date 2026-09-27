import type { Metadata } from "next";
import { GrammarNavigation } from "@/features/grammar/components/grammar-navigation";

export const metadata: Metadata = { title: "Grammar notebook" };

export default function GrammarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-7">
      <GrammarNavigation />
      {children}
    </div>
  );
}
