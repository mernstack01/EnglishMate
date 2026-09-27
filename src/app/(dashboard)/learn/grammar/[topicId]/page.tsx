import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { getGrammarTopic, listGrammarExercises } from "@/services/grammar";
import {
  GrammarCategoryBadge,
  GrammarStatusBadge,
} from "@/features/grammar/components/grammar-notebook";
import { grammarExerciseTypeLabels } from "@/features/grammar/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StartGrammarPracticeButton } from "@/features/learning/components/start-grammar-practice-button";

interface PageProps {
  params: Promise<{ topicId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { topicId } = await params;
  try {
    const topic = await getGrammarTopic(topicId);
    return { title: `Practice: ${topic.title}` };
  } catch {
    return { title: "Grammar Topic" };
  }
}

export default async function LearnGrammarTopicPage({ params }: PageProps) {
  const { topicId } = await params;

  let topic;
  let exercises;
  try {
    topic = await getGrammarTopic(topicId);
    exercises = await listGrammarExercises(topicId);
  } catch {
    notFound();
  }

  const activeExercises = exercises.filter((e) => e.isActive);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/learn/grammar">
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Grammar Learning
          </Link>
        </Button>
      </div>

      {/* Main Hero Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GrammarCategoryBadge category={topic.category} />
          <GrammarStatusBadge status={topic.status} />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {topic.title}
          </h1>
          {topic.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {topic.description}
            </p>
          )}
        </div>

        {/* Quick metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y py-4">
          <div className="text-center p-2 rounded-xl bg-secondary/30">
            <p className="text-xs text-muted-foreground">Exercises</p>
            <p className="text-lg font-bold text-foreground">
              {activeExercises.length}
            </p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/30">
            <p className="text-xs text-muted-foreground">Attempts</p>
            <p className="text-lg font-bold text-foreground">
              {topic.attemptsCount}
            </p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/30">
            <p className="text-xs text-muted-foreground">Accuracy</p>
            <p className="text-lg font-bold text-foreground">
              {topic.accuracy}%
            </p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/30">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-bold text-primary mt-0.5">
              {topic.status}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {activeExercises.length > 0 ? (
            <StartGrammarPracticeButton
              topicId={topic.id}
              label="Start Practice Session"
              className="h-11 px-6 text-sm font-semibold"
            />
          ) : (
            <Button asChild>
              <Link href={`/grammar/${topic.id}/exercises/new`}>
                Add Exercises First
              </Link>
            </Button>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/grammar/${topic.id}`}>
              <BookOpen className="size-4 mr-1.5" />
              View in Notebook
            </Link>
          </Button>
        </div>
      </Card>

      {/* Lesson Content / Notes if present */}
      {topic.content && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Lesson Rules & Notes
            </h2>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-xl bg-secondary/20 p-4 text-sm leading-relaxed text-foreground">
            {topic.content}
          </div>
          {topic.notes && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-primary">Notes: </span>
              <span className="text-foreground">{topic.notes}</span>
            </div>
          )}
        </Card>
      )}

      {/* Exercise list preview */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">
          Included Exercises ({activeExercises.length})
        </h2>
        {activeExercises.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">
            No active exercises yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {activeExercises.map((ex, idx) => (
              <Card
                key={ex.id}
                className="p-4 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {(grammarExerciseTypeLabels as Record<string, string>)[
                        ex.type
                      ] || ex.type}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {ex.question}
                  </p>
                </div>
                {ex.attemptCount > 0 && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {ex.accuracy}%
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
