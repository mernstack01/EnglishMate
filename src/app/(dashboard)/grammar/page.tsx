import { listGrammarTopics } from "@/services/grammar";
import { grammarQuerySchema } from "@/validations/grammar";
import {
  GrammarNotebookHeading,
  GrammarNotebookFilters,
  GrammarNotebookList,
} from "@/features/grammar/components/grammar-notebook";

export default async function GrammarNotebookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = grammarQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : grammarQuerySchema.parse({});
  const result = await listGrammarTopics(query);

  return (
    <div className="space-y-6">
      <GrammarNotebookHeading
        title="Grammar Notebook"
        description="Master English structure through clear rules, explanations, and targeted exercises."
        count={result.total}
      />

      {params.deleted === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Grammar topic deleted from your notebook.
        </p>
      )}

      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid. Showing all topics.
        </p>
      )}

      <GrammarNotebookFilters query={query} />

      <GrammarNotebookList {...result} basePath="/grammar" />
    </div>
  );
}
