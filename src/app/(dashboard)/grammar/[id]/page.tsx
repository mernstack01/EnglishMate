import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Play, Plus, BookOpen, Upload } from "lucide-react";
import { getGrammarTopic, listGrammarExercises } from "@/services/grammar";
import {
  GrammarCategoryBadge,
  GrammarStatusBadge,
} from "@/features/grammar/components/grammar-notebook";
import { grammarExerciseTypeLabels } from "@/features/grammar/constants";
import { longDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function GrammarTopicDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  let topic;
  let exercises;
  try {
    topic = await getGrammarTopic(id);
    exercises = await listGrammarExercises(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/grammar">
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Notebook
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {exercises.length > 0 && (
            <Button asChild size="sm">
              <Link href={`/learn/grammar/${topic.id}/practice`}>
                <Play className="size-4 mr-1.5" />
                Start Practice
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/grammar/${topic.id}/edit`}>
              <Pencil className="size-4 mr-1.5" />
              Edit Topic
            </Link>
          </Button>
        </div>
      </div>

      {query.saved === "1" && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-3 text-sm text-primary"
        >
          Topic saved to your notebook.
        </p>
      )}

      {/* Main Topic Header Card */}
      <Card className="p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GrammarCategoryBadge category={topic.category} />
          <div className="flex items-center gap-2">
            <GrammarStatusBadge status={topic.status} />
            <span className="text-xs text-muted-foreground">
              Added {longDate(topic.date)}
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            {topic.title}
          </h1>
          {topic.description && (
            <p className="mt-2 text-base text-muted-foreground">
              {topic.description}
            </p>
          )}
        </div>

        {/* Lesson Content */}
        {topic.content && (
          <div className="rounded-2xl border bg-secondary/20 p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lesson Rules & Explanations
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {topic.content}
            </div>
          </div>
        )}

        {/* Personal Notes */}
        {topic.notes && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-primary uppercase tracking-wide text-[10px]">
              Notes & Nuances:
            </p>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {topic.notes}
            </p>
          </div>
        )}

        {/* Topic Stats Bar */}
        <div className="flex flex-wrap items-center gap-5 border-t pt-4 text-xs text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">
              {exercises.length}
            </span>{" "}
            {exercises.length === 1 ? "exercise" : "exercises"}
          </span>
          <span>
            <span className="font-bold text-foreground">
              {topic.attemptsCount}
            </span>{" "}
            attempts
          </span>
          {topic.attemptsCount > 0 && (
            <span>
              <span className="font-bold text-foreground">
                {topic.accuracy}%
              </span>{" "}
              accuracy
            </span>
          )}
        </div>
      </Card>

      {/* Exercises Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Exercises</h2>
            <p className="text-xs text-muted-foreground">
              Practice questions for this topic ({exercises.length} total)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/grammar/${topic.id}/exercises/new`}>
                <Plus className="size-4 mr-1.5" />
                Add Exercise
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/grammar/import?topicId=${topic.id}`}>
                <Upload className="size-4 mr-1.5" />
                Import to this topic
              </Link>
            </Button>
          </div>
        </div>

        {exercises.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-base">No exercises yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add multiple choice, fill in the blank, true/false, or sentence
              correction exercises to practice this topic.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button asChild size="sm">
                <Link href={`/grammar/${topic.id}/exercises/new`}>
                  <Plus className="size-4 mr-1.5" />
                  Add first exercise
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/grammar/import?topicId=${topic.id}`}>
                  Import JSON
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex, idx) => (
              <Card key={ex.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {(grammarExerciseTypeLabels as Record<string, string>)[
                        ex.type
                      ] || ex.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/grammar/${topic.id}/exercises/${ex.id}/edit`}
                        aria-label={`Edit exercise ${idx + 1}`}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-foreground">
                  {ex.question}
                </p>

                {/* Options display if multiple choice */}
                {ex.type === "MULTIPLE_CHOICE" && ex.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ex.options.map((opt, oidx) => (
                      <span
                        key={oidx}
                        className={`rounded-lg border px-2 py-0.5 text-xs ${
                          opt === ex.correctAnswer
                            ? "border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300"
                            : "bg-secondary/40 text-muted-foreground"
                        }`}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
                  <p>
                    Correct:{" "}
                    <span className="font-bold text-foreground">
                      {ex.correctAnswer}
                    </span>
                  </p>
                  {ex.attemptCount > 0 && (
                    <span>
                      {ex.attemptCount} attempts · {ex.accuracy}% accuracy
                    </span>
                  )}
                </div>

                {ex.explanation && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-2">
                    {ex.explanation}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
