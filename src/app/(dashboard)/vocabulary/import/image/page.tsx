import type { Metadata } from "next";
import { ImportTabs } from "@/features/vocabulary/components/import-tabs";
import { ImageImportWizard } from "@/features/vocabulary/components/image-import-wizard";

export const metadata: Metadata = {
  title: "Import from Image | EnglishMate",
  description:
    "Extract highlighted and marked vocabulary from textbook photos and automatically enrich with Uzbek translations.",
};

export default function ImageImportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          AI-POWERED EXTRACTION
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Import from textbook photo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Snap or upload a photo of your textbook. EnglishMate detects your
          highlighted, underlined, and circled vocabulary, then prepares Uzbek
          translations and definitions.
        </p>
      </div>

      <ImportTabs />

      <ImageImportWizard />
    </div>
  );
}
