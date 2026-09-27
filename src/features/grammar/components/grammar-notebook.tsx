import Link from "next/link";
import {
  ArrowRight,
  PenLine,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pencil,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  grammarCategoryLabels,
  grammarCategories,
  grammarStatusLabels,
  grammarStatuses,
} from "../constants";
import { longDate } from "@/lib/dates";
import type { listGrammarTopics } from "@/services/grammar";
import type { GrammarTopicDTO } from "@/types/grammar";
import type { GrammarQuery } from "@/validations/grammar";

export const selectClass =
  "h-12 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-ring";

export function GrammarStatusBadge({
  status,
}: {
  status: GrammarTopicDTO["status"];
}) {
  const colors: Record<string, string> = {
    NEW: "bg-muted text-muted-foreground",
    LEARNING: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    DIFFICULT: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    LEARNED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[status] || "bg-muted text-muted-foreground"}`}
    >
      {(grammarStatusLabels as Record<string, string>)[status] || status}
    </span>
  );
}

export function GrammarCategoryBadge({
  category,
}: {
  category: GrammarTopicDTO["category"];
}) {
  return (
    <span className="inline-flex shrink-0 rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-primary">
      {(grammarCategoryLabels as Record<string, string>)[category] || category}
    </span>
  );
}

export function GrammarNotebookHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          YOUR GRAMMAR NOTEBOOK
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {count} {count === 1 ? "topic" : "topics"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/grammar/new">
            <Plus className="size-4" />
            Add grammar topic
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function GrammarNotebookFilters({ query }: { query: GrammarQuery }) {
  return (
    <form method="get" className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Search topic title or notes..."
            className="pl-10"
          />
        </div>

        {/* Category */}
        <select
          name="category"
          defaultValue={query.category}
          className={selectClass}
          aria-label="Filter by grammar category"
        >
          <option value="ALL">All categories</option>
          {grammarCategories.map((c) => (
            <option key={c} value={c}>
              {grammarCategoryLabels[c]}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          name="status"
          defaultValue={query.status}
          className={selectClass}
          aria-label="Filter by learning status"
        >
          <option value="ALL">All statuses</option>
          {grammarStatuses.map((s) => (
            <option key={s} value={s}>
              {grammarStatusLabels[s]}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          name="sort"
          defaultValue={query.sort}
          className={selectClass}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="practice">Needs practice first</option>
          <option value="accuracy">Lowest accuracy first</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {query.date && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-primary">
            Date: {longDate(query.date)}
            <input type="hidden" name="date" value={query.date} />
          </span>
        )}

        <div className="ml-auto flex gap-2">
          {(query.q ||
            query.category !== "ALL" ||
            query.status !== "ALL" ||
            query.date ||
            query.sort !== "newest") && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/grammar">Reset filters</Link>
            </Button>
          )}
          <Button type="submit" size="sm">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}

export function GrammarNotebookList({
  topics,
  total,
  page,
  pages,
  query,
  basePath = "/grammar",
}: Awaited<ReturnType<typeof listGrammarTopics>> & { basePath?: string }) {
  if (topics.length === 0) {
    const isFiltered =
      Boolean(query.q) ||
      query.category !== "ALL" ||
      query.status !== "ALL" ||
      Boolean(query.date);

    return (
      <Card className="p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PenLine className="size-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {isFiltered
            ? "No grammar topics match your filters"
            : "Your grammar notebook is empty"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {isFiltered
            ? "Try loosening your search terms or clearing your category/status filters."
            : "Collect grammar rules, explanations, and exercises (e.g. 'Modal Verbs — Ability', 'Relative Clauses') to master English structure."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isFiltered ? (
            <Button asChild variant="outline">
              <Link href={basePath}>Reset filters</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/grammar/new">
                  <Plus className="size-4 mr-1.5" />
                  Add first topic
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/grammar/import">Import JSON</Link>
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {topics.map((topic) => (
          <Card
            key={topic.id}
            className="flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div className="space-y-3">
              {/* Header: Category & Status */}
              <div className="flex items-start justify-between gap-2">
                <GrammarCategoryBadge category={topic.category} />
                <div className="flex items-center gap-2">
                  <GrammarStatusBadge status={topic.status} />
                  <Link
                    href={`/grammar/${topic.id}/edit`}
                    aria-label={`Edit ${topic.title}`}
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <Link href={`/grammar/${topic.id}`} className="group block">
                  <h2 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {topic.title}
                  </h2>
                </Link>
                {topic.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {topic.description}
                  </p>
                )}
              </div>

              {/* Exercise Count & Stats */}
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <BookOpen className="size-3.5 text-primary" />
                  {topic.exerciseCount}{" "}
                  {topic.exerciseCount === 1 ? "exercise" : "exercises"}
                </span>
                {topic.attemptsCount > 0 && (
                  <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-semibold text-primary">
                    {topic.accuracy}% accuracy
                  </span>
                )}
              </div>
            </div>

            {/* Card Footer: Practice button + Details */}
            <div className="mt-5 flex items-center justify-between border-t pt-3">
              <time
                dateTime={topic.createdAt}
                className="text-[11px] text-muted-foreground"
              >
                {longDate(topic.date)}
              </time>

              <div className="flex items-center gap-2">
                {topic.exerciseCount > 0 ? (
                  <Button asChild size="sm">
                    <Link href={`/learn/grammar/${topic.id}/practice`}>
                      <Play className="size-3.5 mr-1" />
                      Practice
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/grammar/${topic.id}/exercises/new`}>
                      <Plus className="size-3.5 mr-1" />
                      Add exercise
                    </Link>
                  </Button>
                )}

                <Button asChild variant="ghost" size="sm">
                  <Link href={`/grammar/${topic.id}`}>
                    Notes
                    <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pages} ({total} topics total)
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link
                href={`${basePath}?${(() => {
                  const sp = new URLSearchParams();
                  if (query.q) sp.set("q", query.q);
                  if (query.category && query.category !== "ALL")
                    sp.set("category", query.category);
                  if (query.status && query.status !== "ALL")
                    sp.set("status", query.status);
                  if (query.sort) sp.set("sort", query.sort);
                  sp.set("page", String(Math.max(1, page - 1)));
                  return sp.toString();
                })()}`}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <ChevronLeft className="size-4 mr-1" /> Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page >= pages}
            >
              <Link
                href={`${basePath}?${(() => {
                  const sp = new URLSearchParams();
                  if (query.q) sp.set("q", query.q);
                  if (query.category && query.category !== "ALL")
                    sp.set("category", query.category);
                  if (query.status && query.status !== "ALL")
                    sp.set("status", query.status);
                  if (query.sort) sp.set("sort", query.sort);
                  sp.set("page", String(Math.min(pages, page + 1)));
                  return sp.toString();
                })()}`}
                className={
                  page >= pages ? "pointer-events-none opacity-50" : ""
                }
              >
                Next <ChevronRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
