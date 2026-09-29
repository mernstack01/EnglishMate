import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  Sparkles,
  Clock,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildDailyLearningPlan } from "@/services/daily-learning";
import { StartDailyLearningButton } from "@/features/learning/components/start-daily-learning-button";

export const metadata: Metadata = {
  title: "Today's Learning",
  description:
    "Personalized daily learning plan balancing vocabulary, synonyms, and grammar.",
};

export default async function TodayLearningPage() {
  const plan = await buildDailyLearningPlan();

  const hasContent = plan.totalCount > 0;
  const isActive = Boolean(plan.activeSessionId);
  const progressText = plan.activeSessionProgress
    ? `${plan.activeSessionProgress.answered} / ${plan.activeSessionProgress.total}`
    : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>Commute Learning</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Today’s Learning
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One-click balanced practice built from your spaced repetition reviews,
          recent mistakes, and new topics.
        </p>
      </div>

      {hasContent ? (
        <>
          {/* Main Today's Card */}
          <Card className="overflow-hidden border border-border/80">
            <div className="bg-secondary/40 p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  {plan.totalCount} Questions Planned
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />~{plan.estimatedMinutes} minutes
                </span>
              </div>

              {/* Module Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3 divide-x border-y border-border/60 py-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-primary">
                    <BookOpen className="size-4" />
                    <span className="text-xl sm:text-2xl font-bold">
                      {plan.vocabularyCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vocabulary
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
                    <Layers className="size-4" />
                    <span className="text-xl sm:text-2xl font-bold">
                      {plan.synonymsCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Synonyms</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-4" />
                    <span className="text-xl sm:text-2xl font-bold">
                      {plan.grammarCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Grammar</p>
                </div>
              </div>

              {/* Compact Signal Summary: Due, Mistakes, New */}
              <div className="flex flex-wrap items-center justify-around gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-primary" />
                  <strong className="text-foreground">
                    {plan.dueCount}
                  </strong>{" "}
                  Due reviews
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="size-3 text-rose-500" />
                  <strong className="text-foreground">
                    {plan.mistakesCount}
                  </strong>{" "}
                  Mistakes to reinforce
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" />
                  <strong className="text-foreground">
                    {plan.newCount}
                  </strong>{" "}
                  New items
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-6 border-t flex flex-wrap items-center justify-between gap-4">
              <StartDailyLearningButton
                isActive={isActive}
                progressText={progressText}
                className="w-full sm:w-auto"
              />
              <Button asChild variant="ghost" size="sm">
                <Link href="/learn">View All Modules</Link>
              </Button>
            </div>
          </Card>
        </>
      ) : (
        /* Empty State */
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Nothing to study yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your notebook is currently empty. Add vocabulary words, synonym
            groups, or grammar topics to generate your smart daily study plan.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="sm">
              <Link href="/vocabulary/new">Add Vocabulary</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/synonyms/new">Add Synonyms</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/grammar/new">Add Grammar Topic</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
