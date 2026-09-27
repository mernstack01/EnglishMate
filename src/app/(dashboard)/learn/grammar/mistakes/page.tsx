import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2, BookOpen } from "lucide-react";
import { getGrammarMistakes } from "@/services/grammar-learning";
import { GrammarCategoryBadge } from "@/features/grammar/components/grammar-notebook";
import { grammarExerciseTypeLabels } from "@/features/grammar/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StartGrammarPracticeButton } from "@/features/learning/components/start-grammar-practice-button";

export const metadata: Metadata = {
  title: "Grammar Mistakes",
  description: "Review and practice your recent grammar mistakes",
};

export default async function GrammarMistakesPage() {
  const groups = await getGrammarMistakes();
  const totalMistakes = groups.reduce((acc, g) => acc + g.mistakesCount, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button & top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/learn/grammar">
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Grammar Learning
          </Link>
        </Button>

        {totalMistakes > 0 && (
          <StartGrammarPracticeButton
            isMistakes
            label="Practice All Mistakes"
            className="h-9 px-4 text-xs font-semibold"
          />
        )}
      </div>

      {/* Header card */}
      <Card className="p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
          <AlertCircle className="size-5" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Mistake Tracking
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Grammar Mistakes
        </h1>
        <p className="text-sm text-muted-foreground">
          Review exercises you recently answered incorrectly. Questions are
          grouped by topic so you can target your weak areas.
        </p>
      </Card>

      {/* Zero state */}
      {groups.length === 0 ? (
        <Card className="p-10 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              No recent mistakes!
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              You haven&apos;t made any recent mistakes in grammar practice
              sessions. Keep up the great work!
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button asChild>
              <Link href="/learn/grammar">Explore Topics</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/grammar">
                <BookOpen className="size-4 mr-1.5" /> Grammar Notebook
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        /* Mistake Groups */
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.topicId} className="p-5 sm:p-6 space-y-4">
              {/* Group header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GrammarCategoryBadge category={group.category} />
                    <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      {group.mistakesCount}{" "}
                      {group.mistakesCount === 1 ? "mistake" : "mistakes"}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    {group.topicTitle}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <StartGrammarPracticeButton
                    topicId={group.topicId}
                    isMistakes
                    label="Practice this topic"
                    size="sm"
                    variant="outline"
                  />
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/grammar/${group.topicId}`}>Topic Notes</Link>
                  </Button>
                </div>
              </div>

              {/* Group mistakes list */}
              <div className="space-y-3">
                {group.recentMistakes.map((mistake) => (
                  <div
                    key={mistake.attemptId}
                    className="rounded-xl border bg-secondary/20 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        {(grammarExerciseTypeLabels as Record<string, string>)[
                          mistake.exerciseType
                        ] || mistake.exerciseType}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(mistake.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-foreground">
                      {mistake.question}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
                      <div className="rounded-lg bg-rose-500/10 px-3 py-1 text-rose-700 dark:text-rose-300">
                        <span className="font-semibold text-rose-500">
                          Your answer:{" "}
                        </span>
                        <span className="font-medium line-through">
                          {mistake.userAnswer || "(empty)"}
                        </span>
                      </div>

                      <div className="rounded-lg bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Correct:{" "}
                        </span>
                        <span className="font-bold">
                          {mistake.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {mistake.explanation && (
                      <p className="border-l-2 border-primary/20 pl-2.5 italic text-muted-foreground pt-1">
                        {mistake.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
