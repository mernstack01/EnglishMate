import { listGrammarTopics } from "@/services/grammar";
import { GrammarImportForm } from "@/features/grammar/components/grammar-import-form";

export default async function GrammarImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const defaultTopicId =
    typeof params.topicId === "string" ? params.topicId : undefined;

  const topicsRes = await listGrammarTopics({ limit: 100 });
  const existingTopics = topicsRes.topics.map((t) => ({
    id: t.id,
    title: t.title,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          BATCH DATA ENTRY
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Import Grammar Topics & Exercises
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import complete grammar lessons with exercises, or add exercises to an
          existing topic. Content is validated before anything is saved.
        </p>
      </div>

      <GrammarImportForm
        existingTopics={existingTopics}
        defaultTopicId={defaultTopicId}
      />
    </div>
  );
}
