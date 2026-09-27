import type { Metadata } from "next";
import Link from "next/link";
import {
  Layers,
  Sparkles,
  AlertCircle,
  Clock,
  Flame,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSynonymLearningOverview } from "@/services/synonym-learning";
import { StartSynonymSessionButton } from "@/features/learning/components/start-synonym-session-button";

export const metadata: Metadata = { title: "Learn Synonyms" };

export default async function LearnSynonymsPage() {
  const overview = await getSynonymLearningOverview();

  const hasGroups = overview.totalCount > 0;
  const isCaughtUp = overview.dueCount === 0 && hasGroups;

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
            Synonym Learning
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Master nuances, expand your expression, and practice recognizing
            synonym clusters.
          </p>
        </div>

        {overview.streak > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Flame className="size-4 fill-amber-500 text-amber-500" />
            {overview.streak} Day Study Streak
          </span>
        )}
      </div>

      {/* Main Action Banner */}
      {!hasGroups ? (
        <Card className="border-dashed p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layers className="size-7" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            No synonym groups added yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add synonym groups you encounter in reading or practice. EnglishMate
            will automatically schedule them for spaced repetition.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/synonyms/new">
                Add your first group <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/synonyms/import">Import JSON</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Hero Card */}
          <Card className="overflow-hidden border">
            <div className="bg-secondary/70 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Layers className="size-3.5" /> SYNONYM PRACTICE
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {isCaughtUp
                      ? "You're caught up! 🌟"
                      : "Ready for synonym practice?"}
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {isCaughtUp
                      ? "All due synonym groups have been reviewed. You can still practice new or difficult groups anytime."
                      : `${overview.dueCount} synonym groups are due for review. Strengthen your retention with an interactive session.`}
                  </p>
                </div>

                <div className="shrink-0">
                  <StartSynonymSessionButton
                    type="DAILY"
                    label={
                      isCaughtUp ? "Extra Practice" : "Start Synonym Practice"
                    }
                    className="min-h-12 w-full px-8 text-base font-semibold sm:w-auto"
                  />
                </div>
              </div>

              {/* Stats Bar */}
              <div className="mt-6 grid grid-cols-3 divide-x border-t border-border/60 pt-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary sm:text-3xl">
                    {overview.dueCount}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Due groups
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold sm:text-3xl">
                    {overview.newCount}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    New groups
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600 sm:text-3xl dark:text-amber-400">
                    {overview.difficultCount}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Difficult groups
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Targeted Practice Modes */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Targeted Practice Modes
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Due Groups */}
              <Card className="flex flex-col justify-between p-5">
                <div>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="size-5" />
                  </div>
                  <h3 className="font-semibold text-sm">Review Due Groups</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prioritizes synonym groups whose spaced repetition interval
                    has matured.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <StartSynonymSessionButton
                    type="DUE"
                    label="Review Due"
                    variant="outline"
                    className="w-full text-xs"
                  />
                </div>
              </Card>

              {/* New Groups */}
              <Card className="flex flex-col justify-between p-5">
                <div>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-5" />
                  </div>
                  <h3 className="font-semibold text-sm">Practice New Groups</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Focus on recently added synonym clusters with recognition
                    and typing.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <StartSynonymSessionButton
                    type="NEW"
                    label="Practice New"
                    variant="outline"
                    className="w-full text-xs"
                  />
                </div>
              </Card>

              {/* Difficult Groups */}
              <Card className="flex flex-col justify-between p-5">
                <div>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="size-5" />
                  </div>
                  <h3 className="font-semibold text-sm">
                    Practice Difficult Groups
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reinforce tricky groups and past mistakes with targeted
                    exercises.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <StartSynonymSessionButton
                    type="DIFFICULT"
                    label="Practice Difficult"
                    variant="outline"
                    className="w-full text-xs"
                  />
                </div>
              </Card>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
