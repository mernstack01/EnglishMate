import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { synonymsCalendar, listSynonymGroups } from "@/services/synonyms";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, adjacentMonth, longDate } from "@/lib/dates";
import {
  synonymMonthSchema,
  synonymDateSchema,
  synonymQuerySchema,
} from "@/validations/synonyms";
import {
  SynonymNotebookHeading,
  SynonymNotebook,
} from "@/features/synonyms/components/synonym-notebook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function SynonymCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = dateKey(new Date(), vocabularyTimezone());
  const parsedMonth = synonymMonthSchema.safeParse(
    params.month ?? today.slice(0, 7),
  );
  const month = parsedMonth.success ? parsedMonth.data : today.slice(0, 7);
  const parsedDate = synonymDateSchema.safeParse(params.date);
  const selected =
    parsedDate.success && parsedDate.data.startsWith(month)
      ? parsedDate.data
      : month === today.slice(0, 7)
        ? today
        : `${month}-01`;

  const parsedQuery = synonymQuerySchema.safeParse({
    date: selected,
    page: params.page,
  });

  const [calendar, result] = await Promise.all([
    synonymsCalendar(month),
    listSynonymGroups(
      parsedQuery.success ? parsedQuery.data : { date: selected },
    ),
  ]);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

  const count = Object.values(calendar.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <SynonymNotebookHeading
        title="Synonym Calendar"
        description="Browse synonym groups by creation date."
      />

      <Card className="mx-auto max-w-3xl p-3 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{monthLabel}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {count} groups added this month
            </p>
          </div>
          <div className="flex gap-1">
            {month > "1970-01" ? (
              <Button asChild variant="ghost" size="icon">
                <Link
                  href={`/synonyms/calendar?month=${adjacentMonth(month, -1)}`}
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/synonyms/calendar">This month</Link>
            </Button>
            {month < "2100-12" ? (
              <Button asChild variant="ghost" size="icon">
                <Link
                  href={`/synonyms/calendar?month=${adjacentMonth(month, 1)}`}
                  aria-label="Next month"
                >
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            )}
          </div>
        </div>

        <form action="/synonyms/calendar" className="mb-6 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="month" className="mb-2 block text-xs font-medium">
              Jump to month
            </label>
            <Input
              id="month"
              name="month"
              type="month"
              defaultValue={month}
              key={month}
              min="1970-01"
              max="2100-12"
              required
            />
          </div>
          <Button variant="outline" className="h-12">
            Go
          </Button>
        </form>

        {!parsedMonth.success && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            Invalid month. Showing the current month.
          </p>
        )}

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold text-muted-foreground sm:text-xs"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: calendar.offset }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: calendar.days }, (_, i) => {
            const key = `${month}-${String(i + 1).padStart(2, "0")}`;
            const n = calendar.counts[key] || 0;
            return (
              <Link
                key={key}
                href={`/synonyms/calendar?month=${month}&date=${key}`}
                aria-label={`${longDate(key)}: ${n} groups`}
                aria-current={key === selected ? "date" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-colors sm:min-h-20",
                  key === selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : n
                      ? "border-primary/15 bg-secondary text-primary hover:border-primary"
                      : "border-transparent hover:bg-muted",
                  key === today && key !== selected && "ring-1 ring-primary/50",
                )}
              >
                <span className="text-sm font-semibold">{i + 1}</span>
                <span
                  className={cn(
                    "text-[9px] sm:text-[11px]",
                    !n && "opacity-40",
                  )}
                >
                  {n ? (
                    <>
                      {n}
                      <span className="hidden sm:inline">
                        {" "}
                        {n === 1 ? "group" : "groups"}
                      </span>
                    </>
                  ) : (
                    "·"
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Choose a date to open that page of your synonym notebook.
        </p>
      </Card>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">{longDate(selected)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "group" : "groups"}
          </p>
        </div>
        <SynonymNotebook data={result} basePath="/synonyms/calendar" />
      </section>
    </div>
  );
}
