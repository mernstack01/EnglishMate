import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { synonymStatusLabels, synonymStatuses } from "../constants";
import { longDate } from "@/lib/dates";
import type { listSynonymGroups } from "@/services/synonyms";
import type { SynonymGroupDTO } from "@/types/synonyms";
import type { SynonymQuery } from "@/validations/synonyms";
import { SynonymStatusActions } from "./synonym-status-actions";

export const selectClass =
  "h-12 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-ring";

export function SynonymStatusBadge({
  status,
}: {
  status: SynonymGroupDTO["status"];
}) {
  const colors = {
    NEW: "bg-muted text-muted-foreground",
    LEARNING: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    DIFFICULT: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    LEARNED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[status]}`}
    >
      {synonymStatusLabels[status]}
    </span>
  );
}

export function SynonymNotebookHeading({
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
          YOUR SYNONYM NOTEBOOK
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        {count !== undefined && (
          <p className="mt-2 text-sm font-medium">
            {count} {count === 1 ? "group" : "groups"}
          </p>
        )}
      </div>
      <Button asChild>
        <Link href="/synonyms/new">
          <Plus className="size-4 mr-1.5" />
          Add synonym group
        </Link>
      </Button>
    </div>
  );
}

export function SynonymNotebookFilters({
  query,
  basePath,
}: {
  query: SynonymQuery;
  basePath: string;
}) {
  return (
    <form
      method="get"
      action={basePath}
      className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Search main term or synonyms..."
            className="pl-9"
          />
        </div>

        <select
          name="status"
          defaultValue={query.status}
          className={selectClass}
          aria-label="Filter by learning status"
        >
          <option value="ALL">All statuses</option>
          {synonymStatuses.map((st) => (
            <option key={st} value={st}>
              {synonymStatusLabels[st]}
            </option>
          ))}
        </select>

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
            query.status !== "ALL" ||
            query.date ||
            query.sort !== "newest") && (
            <Button asChild variant="ghost" size="sm">
              <Link href={basePath}>Reset filters</Link>
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

export function SynonymNotebook({
  data,
  basePath,
}: {
  data: Awaited<ReturnType<typeof listSynonymGroups>>;
  basePath: string;
}) {
  const { groups, page, pages, total, query } = data;

  if (total === 0) {
    return (
      <Card className="border-dashed p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Layers className="size-7" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {query.q || query.status !== "ALL" || query.date
            ? "No matching synonym groups found"
            : "Your synonym notebook is empty"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {query.q || query.status !== "ALL" || query.date
            ? "Try broadening your search term or resetting active filters."
            : "Collect groups of related words (e.g. 'want to', 'problem', 'mostly') to master expressive English."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {query.q || query.status !== "ALL" || query.date ? (
            <Button asChild variant="outline">
              <Link href={basePath}>Reset filters</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/synonyms/new">
                  <Plus className="size-4 mr-1.5" /> Add first group
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/synonyms/import">Import JSON</Link>
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Card
            key={group.id}
            className="flex flex-col justify-between p-5 transition-colors hover:border-primary/40"
          >
            <div className="space-y-3">
              {/* Header: Term, Status, Edit Link */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight uppercase">
                    {group.term}
                  </h2>
                  {group.meaning && (
                    <p className="mt-0.5 text-sm font-medium text-primary">
                      {group.meaning}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SynonymStatusBadge status={group.status} />
                  <Link
                    href={`/synonyms/${group.id}`}
                    aria-label={`Edit ${group.term}`}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </Link>
                </div>
              </div>

              {/* Synonyms Chips */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Synonyms ({group.synonyms.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.synonyms.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-lg border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground"
                      title={s.example || undefined}
                    >
                      {s.word}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {group.notes && (
                <p className="line-clamp-2 text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mt-2">
                  {group.notes}
                </p>
              )}
            </div>

            {/* Card Footer: Date, Quick Status Actions, Details Link */}
            <div className="mt-5 border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <time dateTime={group.createdAt}>{longDate(group.date)}</time>
                <Link
                  href={`/synonyms/${group.id}`}
                  className="font-semibold text-primary inline-flex items-center hover:underline"
                >
                  Details <ArrowRight className="size-3 ml-1" />
                </Link>
              </div>

              <SynonymStatusActions group={group} />
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pages} ({total} groups total)
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...query,
                  page: String(Math.max(1, page - 1)),
                }).toString()}`}
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
                href={`${basePath}?${new URLSearchParams({
                  ...query,
                  page: String(Math.min(pages, page + 1)),
                }).toString()}`}
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
