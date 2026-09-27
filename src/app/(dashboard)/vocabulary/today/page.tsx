import { listVocabulary } from "@/services/vocabulary";
import { vocabularyQuerySchema } from "@/validations/vocabulary";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, longDate } from "@/lib/dates";
import {
  NotebookHeading,
  VocabularyFilters,
  NotebookResults,
} from "@/features/vocabulary/components/notebook";
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const today = dateKey(new Date(), vocabularyTimezone());
  const parsed = vocabularyQuerySchema.safeParse({
    ...(await searchParams),
    date: today,
  });
  const query = parsed.success
    ? parsed.data
    : vocabularyQuerySchema.parse({ date: today });
  const result = await listVocabulary(query);
  return (
    <div className="space-y-6">
      <NotebookHeading
        title="Today’s vocabulary"
        description={`${longDate(today)} · A fresh page for new discoveries.`}
        count={result.total}
      />
      <p className="text-xs text-muted-foreground">
        Keep collecting. Practice sessions are coming in the next phase.
      </p>
      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid and have been reset.
        </p>
      )}
      <VocabularyFilters
        key={JSON.stringify(query)}
        query={query}
        base="/vocabulary/today"
        fixedDate
      />
      <NotebookResults
        result={result}
        base="/vocabulary/today"
        emptyTitle="No words added today."
      />
    </div>
  );
}
