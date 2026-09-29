import type { Metadata } from "next";
import { ScannerContainer } from "@/features/scanner/components/scanner-container";

export const metadata: Metadata = {
  title: "Scan Page · Vocabulary Scanner | EnglishMate",
  description:
    "Photograph or upload textbook pages to recognize English words and physical highlighter/underline marks directly on your device.",
};

export default function VocabularyScannerPage() {
  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">
          Offline Textbook Scanner
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Scan Page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Photograph a textbook page or upload an image. The scanner detects
          English words and physical markings (highlighters and underlines)
          right on your device.
        </p>
      </div>

      <ScannerContainer />
    </div>
  );
}
