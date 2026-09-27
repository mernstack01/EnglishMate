import { SynonymImportForm } from "@/features/synonyms/components/synonym-import-form";

export default function SynonymImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          BULK IMPORT
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Import Synonym Groups
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste your JSON collection, inspect the preview, and confirm to
          import.
        </p>
      </div>

      <SynonymImportForm />
    </div>
  );
}
