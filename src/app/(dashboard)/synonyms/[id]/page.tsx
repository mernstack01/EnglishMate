import Link from "next/link";
import { notFound } from "next/navigation";
import { getSynonymGroup, SynonymError } from "@/services/synonyms";
import { SynonymForm } from "@/features/synonyms/components/synonym-form";
import { SynonymStatusBadge } from "@/features/synonyms/components/synonym-notebook";
import { longDate } from "@/lib/dates";

export default async function SynonymDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const group = await getSynonymGroup(id).catch((error) => {
    if (error instanceof SynonymError) notFound();
    throw error;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/synonyms"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
      >
        ← Back to synonym notebook
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold tracking-tight uppercase">
            {group.term}
          </h1>
          {group.meaning && (
            <p className="mt-1 text-base font-semibold text-primary">
              {group.meaning}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Added {longDate(group.date)} ·{" "}
            {group.source === "JSON" ? "JSON import" : "Manual entry"}
          </p>
        </div>
        <SynonymStatusBadge status={group.status} />
      </div>

      {(await searchParams).saved === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Synonym group added to your notebook.
        </p>
      )}

      <SynonymForm group={group} />
    </div>
  );
}
