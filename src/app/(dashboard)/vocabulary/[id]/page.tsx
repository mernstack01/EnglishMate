import Link from "next/link";
import { notFound } from "next/navigation";
import { getVocabulary, VocabularyError } from "@/services/vocabulary";
import {
  WordForm,
  DeleteWordForm,
} from "@/features/vocabulary/components/word-form";
import { StatusBadge } from "@/features/vocabulary/components/notebook";
import { longDate } from "@/lib/dates";
export default async function WordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const word = await getVocabulary(id).catch((error) => {
    if (error instanceof VocabularyError) notFound();
    throw error;
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/vocabulary"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        ← Back to your notebook
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold tracking-tight">
            {word.word}
          </h1>
          <p className="mt-3 text-xs text-muted-foreground">
            Added {longDate(word.date)} ·{" "}
            {word.source === "JSON" ? "JSON import" : "Manual entry"}
          </p>
        </div>
        <StatusBadge status={word.status} />
      </div>
      {(await searchParams).saved === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Word added to your notebook.
        </p>
      )}
      <WordForm word={word} />
      <DeleteWordForm id={word.id} />
    </div>
  );
}
