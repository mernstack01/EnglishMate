import { listSynonymGroups } from "@/services/synonyms";
import { synonymQuerySchema } from "@/validations/synonyms";
import {
  SynonymNotebookHeading,
  SynonymNotebookFilters,
  SynonymNotebook,
} from "@/features/synonyms/components/synonym-notebook";

export default async function SynonymsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = synonymQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : synonymQuerySchema.parse({});
  const result = await listSynonymGroups(query);

  return (
    <div className="space-y-6">
      <SynonymNotebookHeading
        title="Synonym Notebook"
        description="Organize related words into powerful groups. Learn the fine shades of meaning."
        count={result.total}
      />

      {params.deleted === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Synonym group deleted from your notebook.
        </p>
      )}

      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid. Showing all synonym groups.
        </p>
      )}

      <SynonymNotebookFilters
        key={JSON.stringify(query)}
        query={query}
        basePath="/synonyms"
      />

      <SynonymNotebook data={result} basePath="/synonyms" />
    </div>
  );
}
