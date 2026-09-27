import { listGrammarTopics } from "@/services/grammar";
import { grammarQuerySchema } from "@/validations/grammar";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, longDate } from "@/lib/dates";
import {
  GrammarNotebookHeading,
  GrammarNotebookFilters,
  GrammarNotebookList,
} from "@/features/grammar/components/grammar-notebook";

export default async function GrammarTodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const today = dateKey(new Date(), vocabularyTimezone());
  const params = await searchParams;
  const parsed = grammarQuerySchema.safeParse({
    ...params,
    date: today,
  });
  const query = parsed.success
    ? parsed.data
    : grammarQuerySchema.parse({ date: today });
  const result = await listGrammarTopics(query);

  return (
    <div className="space-y-6">
      <GrammarNotebookHeading
        title="Today’s Grammar Topics"
        description={`${longDate(today)} · Grammar topics and rules added today.`}
        count={result.total}
      />

      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid and have been reset.
        </p>
      )}

      <GrammarNotebookFilters query={query} />

      <GrammarNotebookList {...result} basePath="/grammar/today" />
    </div>
  );
}
