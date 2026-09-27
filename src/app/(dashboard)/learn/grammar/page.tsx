import type { Metadata } from "next";
import Link from "next/link";
import {
  PenLine,
  Sparkles,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGrammarLearningOverview } from "@/services/grammar-learning";
import { StartGrammarPracticeButton } from "@/features/learning/components/start-grammar-practice-button";
import {
  GrammarCategoryBadge,
  GrammarStatusBadge,
} from "@/features/grammar/components/grammar-notebook";
import type {
  GrammarCategory,
  GrammarStatus,
} from "@/features/grammar/constants";

export const metadata: Metadata = { title: "Learn Grammar" };

export default async function LearnGrammarPage() {
  const overview = await getGrammarLearningOverview();

  const hasTopics = overview.totalTopics > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/learn"
              className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              ← All Learning Modules
            </Link>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Grammar Practice
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Study English structures through interactive exercises, instant
            explanations, and mistake tracking.
          </p>
        </div>

        {overview.mistakesCount > 0 && (
          <Button asChild variant="outline" size="sm">
            <Link href="/learn/grammar/mistakes">
              <AlertCircle className="size-4 mr-1.5 text-amber-500" />
              {overview.mistakesCount} Mistakes to Review
            </Link>
          </Button>
        )}
      </div>

      {/* Main Action Banner */}
      {!hasTopics ? (
        <Card className="border-dashed p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PenLine className="size-7" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            No grammar topics added yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create grammar topics like &ldquo;Modal Verbs — Ability&rdquo; or
            &ldquo;Relative Clauses&rdquo; and add practice exercises to master
            English structure.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/grammar/new">
                Add your first topic <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/grammar/import">Import JSON</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Quick Stats Grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Topics
                </span>
                <PenLine className="size-4 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-bold">{overview.totalTopics}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                In your grammar notebook
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Needs Practice
                </span>
                <Sparkles className="size-4 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">
                {overview.needsPracticeCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                New or difficult topics
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recorded Mistakes
                </span>
                <AlertCircle className="size-4 text-amber-500" />
              </div>
              <p className="mt-3 text-3xl font-bold text-amber-600 dark:text-amber-400">
                {overview.mistakesCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.mistakesCount > 0 ? (
                  <Link
                    href="/learn/grammar/mistakes"
                    className="underline hover:text-foreground"
                  >
                    Review mistakes
                  </Link>
                ) : (
                  "Clean sheet so far!"
                )}
              </p>
            </Card>
          </div>

          {/* Practice By Topic Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Choose a Topic to Practice
                </h2>
                <p className="text-xs text-muted-foreground">
                  One question at a time with immediate feedback and
                  explanation.
                </p>
              </div>

              {overview.mistakesCount > 0 && (
                <StartGrammarPracticeButton
                  isMistakes
                  variant="outline"
                  size="sm"
                  label="Practice Mistakes"
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.topics.map((t) => (
                <Card
                  key={t.id}
                  className="flex flex-col justify-between p-5 transition-all hover:border-primary/40"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <GrammarCategoryBadge
                        category={t.category as GrammarCategory}
                      />
                      <GrammarStatusBadge status={t.status as GrammarStatus} />
                    </div>

                    <div>
                      <h3 className="font-bold text-base tracking-tight text-foreground">
                        {t.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.exerciseCount}{" "}
                        {t.exerciseCount === 1 ? "exercise" : "exercises"}
                        {t.attemptsCount > 0 && ` · ${t.accuracy}% accuracy`}
                        {t.mistakesCount > 0 && (
                          <span className="text-destructive font-semibold">
                            {" "}
                            · {t.mistakesCount} mistakes
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t pt-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/grammar/${t.id}`}>
                        <BookOpen className="size-3.5 mr-1" />
                        Notes
                      </Link>
                    </Button>

                    {t.exerciseCount > 0 ? (
                      <StartGrammarPracticeButton
                        topicId={t.id}
                        size="sm"
                        label="Practice"
                        ariaLabel={`Practice ${t.title}`}
                      />
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/grammar/${t.id}/exercises/new`}>
                          Add exercise
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
