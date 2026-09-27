import { ImportForm } from "@/features/vocabulary/components/import-form";
import { ImportTabs } from "@/features/vocabulary/components/import-tabs";
export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          BRING YOUR WORDS ALONG
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A whole page, in one go.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Paste your collection, check the preview, then add it to your
          notebook.
        </p>
      </div>
      <ImportTabs />
      <ImportForm />
    </div>
  );
}
