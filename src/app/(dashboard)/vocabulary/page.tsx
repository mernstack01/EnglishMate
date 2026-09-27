import { listVocabulary } from "@/services/vocabulary";
import { vocabularyQuerySchema } from "@/validations/vocabulary";
import {
  NotebookHeading,
  VocabularyFilters,
  NotebookResults,
} from "@/features/vocabulary/components/notebook";
export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = vocabularyQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : vocabularyQuerySchema.parse({});
  const result = await listVocabulary(query);
  return (
    <div className="space-y-6">
      <NotebookHeading
        title="Words worth keeping."
        description="Little discoveries, collected day by day. Make them your own."
        count={result.total}
      />
      {params.deleted === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Word deleted from your notebook.
        </p>
      )}
      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid. Showing all words.
        </p>
      )}
      <VocabularyFilters key={JSON.stringify(query)} query={query} />
      <NotebookResults
        result={result}
        emptyTitle={
          query.q || query.date || query.status !== "ALL"
            ? "No words match these filters."
            : undefined
        }
      />
    </div>
  );
}
