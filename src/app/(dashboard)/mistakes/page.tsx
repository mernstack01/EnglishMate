import type { Metadata } from "next";
import { getUnifiedMistakes } from "@/services/mistakes";
import { MistakesBook } from "@/features/mistakes/components/mistakes-book";

export const metadata: Metadata = {
  title: "Mistakes Book",
  description:
    "Unified book of missed vocabulary, synonyms, and grammar exercises with smart resolution tracking.",
};

export default async function MistakesPage() {
  const summary = await getUnifiedMistakes();
  return <MistakesBook initialSummary={summary} />;
}
