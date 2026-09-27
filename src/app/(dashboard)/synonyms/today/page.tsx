import { listSynonymGroups } from "@/services/synonyms";
import { synonymQuerySchema } from "@/validations/synonyms";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, longDate } from "@/lib/dates";
import {
  SynonymNotebookHeading,
  SynonymNotebookFilters,
  SynonymNotebook,
} from "@/features/synonyms/components/synonym-notebook";

export default async function SynonymsTodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const today = dateKey(new Date(), vocabularyTimezone());
  const params = await searchParams;
  const parsed = synonymQuerySchema.safeParse({
    ...params,
    date: today,
  });
  const query = parsed.success
    ? parsed.data
    : synonymQuerySchema.parse({ date: today });
  const result = await listSynonymGroups(query);

  return (
    <div className="space-y-6">
      <SynonymNotebookHeading
        title="Today’s Synonym Groups"
        description={`${longDate(today)} · Synonym groups added today.`}
        count={result.total}
      />

      {!parsed.success && (
        <p role="alert" className="text-sm text-destructive">
          Some filters were invalid and have been reset.
        </p>
      )}

      <SynonymNotebookFilters
        key={JSON.stringify(query)}
        query={query}
        basePath="/synonyms/today"
      />

      <SynonymNotebook data={result} basePath="/synonyms/today" />
    </div>
  );
}
