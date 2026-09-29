import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { statusLabels, wordStatuses } from "../constants";
import { dayLabel, longDate } from "@/lib/dates";
import type { listVocabulary } from "@/services/vocabulary";
import type { VocabularyDTO } from "@/types/vocabulary";
import type { VocabularyQuery } from "@/validations/vocabulary";
import { StatusActions } from "./status-actions";
export const selectClass =
  "h-12 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-ring";
export function StatusBadge({ status }: { status: VocabularyDTO["status"] }) {
  const colors = {
    NEW: "bg-muted text-muted-foreground",
    LEARNING: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    DIFFICULT: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    LEARNED: "bg-secondary text-primary",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
export function NotebookHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary">
          YOUR PERSONAL NOTEBOOK
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        {count !== undefined && (
          <p className="mt-2 text-sm font-medium">
            {count} {count === 1 ? "word" : "words"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/vocabulary/scanner">
            <Camera className="size-4" />
            Scan Page
          </Link>
        </Button>
        <Button asChild>
          <Link href="/vocabulary/new">
            <Plus />
            Add word
          </Link>
        </Button>
      </div>
    </div>
  );
}
export function VocabularyFilters({
  query,
  base = "/vocabulary",
  fixedDate = false,
}: {
  query: VocabularyQuery;
  base?: string;
  fixedDate?: boolean;
}) {
  return (
    <form
      action={base}
      className="grid grid-cols-2 items-end gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4 xl:grid-cols-6"
    >
      <div className="col-span-2">
        <label htmlFor="q" className="mb-2 block text-xs font-medium">
          Find a word or translation
        </label>
        <Input
          id="q"
          name="q"
          placeholder="What are you looking for?"
          defaultValue={query.q}
          maxLength={100}
        />
      </div>
      <div>
        <label htmlFor="status" className="mb-2 block text-xs font-medium">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={query.status}
          className={selectClass}
        >
          <option value="ALL">All words</option>
          {wordStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sort" className="mb-2 block text-xs font-medium">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={query.sort}
          className={selectClass}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="az">A–Z</option>
          <option value="za">Z–A</option>
        </select>
      </div>
      {!fixedDate && (
        <div>
          <label htmlFor="date" className="mb-2 block text-xs font-medium">
            Added on
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={query.date}
            min="1970-01-01"
            max="2100-12-31"
            className="text-sm"
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-12 flex-1">
          <Search />
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={base}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}
function WordCard({ word }: { word: VocabularyDTO }) {
  return (
    <article
      data-word-id={word.id}
      className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/vocabulary/${word.id}`}
          className="min-w-0 flex-1 rounded-sm focus-visible:outline-ring"
        >
          <h3 className="break-words text-xl leading-snug font-semibold tracking-tight text-primary">
            {word.word}
          </h3>
          <p className="mt-2 break-words text-sm leading-relaxed">
            {word.translation}
          </p>
        </Link>
        <StatusBadge status={word.status} />
      </div>
      {(word.partOfSpeech || word.pronunciation) && (
        <p className="mt-3 break-words text-xs text-muted-foreground">
          {[word.partOfSpeech, word.pronunciation].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <StatusActions word={word} />
        <Link
          href={`/vocabulary/${word.id}`}
          aria-label={`Open ${word.word}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          Details
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <time
        dateTime={word.createdAt}
        className="mt-2 block text-[11px] text-muted-foreground"
      >
        {longDate(word.date)}
      </time>
    </article>
  );
}
export function NotebookResults({
  result,
  base = "/vocabulary",
  extra = {},
  emptyTitle = "Your next word starts here.",
}: {
  result: Awaited<ReturnType<typeof listVocabulary>>;
  base?: string;
  extra?: Record<string, string>;
  emptyTitle?: string;
}) {
  const { words, query, total, page, pages, today } = result;
  const groups: { key: string; words: VocabularyDTO[] }[] = [];
  if (query.sort === "az" || query.sort === "za") {
    if (words.length) groups.push({ key: "Alphabetical", words });
  } else
    for (const word of words) {
      const last = groups.at(-1);
      if (last?.key === word.date) last.words.push(word);
      else groups.push({ key: word.date, words: [word] });
    }
  const pageUrl = (n: number) =>
    `${base}?${new URLSearchParams({ ...query, page: String(n), ...extra })}`;
  return (
    <div className="space-y-7">
      {!words.length ? (
        <Card className="px-6 py-14 text-center">
          <BookOpen className="mx-auto size-10 text-primary/60" />
          <h2 className="mt-5 text-xl font-semibold">{emptyTitle}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {query.q || query.status !== "ALL" || query.date
              ? "Try a different search or date, or add a word to your notebook."
              : "A word and its meaning are all you need. Your collection will grow one small discovery at a time."}
          </p>
          <Button asChild className="mt-6">
            <Link href="/vocabulary/new">
              <Plus />
              Add your first word
            </Link>
          </Button>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">
                {group.key === "Alphabetical"
                  ? group.key
                  : dayLabel(group.key, today)}
              </h2>
              <span className="text-xs text-muted-foreground">
                {group.words.length} on this page
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.words.map((word) => (
                <WordCard key={word.id} word={word} />
              ))}
            </div>
          </section>
        ))
      )}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {total} words · Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageUrl(page - 1)}>
                  <ChevronLeft />
                  Previous
                </Link>
              </Button>
            ) : (
              <Button disabled variant="outline" size="sm">
                <ChevronLeft />
                Previous
              </Button>
            )}
            {page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageUrl(page + 1)}>
                  Next
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <Button disabled variant="outline" size="sm">
                Next
                <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Notebook dates use {result.timezone.replaceAll("_", " ")} time.
      </p>
    </div>
  );
}
