import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  Sparkles,
  AlertCircle,
  Flame,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLearningOverview } from "@/services/learning";
import { getSynonymLearningOverview } from "@/services/synonym-learning";
import { getGrammarLearningOverview } from "@/services/grammar-learning";
import { buildDailyLearningPlan } from "@/services/daily-learning";
import { StartDailyLearningButton } from "@/features/learning/components/start-daily-learning-button";
import { StartSessionButton } from "@/features/learning/components/start-session-button";
import { StartSynonymSessionButton } from "@/features/learning/components/start-synonym-session-button";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const [vocabOverview, synonymOverview, grammarOverview, dailyPlan] =
    await Promise.all([
      getLearningOverview(),
      getSynonymLearningOverview(),
      getGrammarLearningOverview(),
      buildDailyLearningPlan(),
    ]);

  const streak = Math.max(vocabOverview.streak, synonymOverview.streak);
  const hasVocab = vocabOverview.totalCount > 0;
  const hasSynonyms = synonymOverview.totalCount > 0;
  const hasGrammar = grammarOverview.totalTopics > 0;
  const hasDailyContent = dailyPlan.totalCount > 0;

  const isDailyActive = Boolean(dailyPlan.activeSessionId);
  const dailyProgressText = dailyPlan.activeSessionProgress
    ? `${dailyPlan.activeSessionProgress.answered} / ${dailyPlan.activeSessionProgress.total}`
    : undefined;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Interactive Learning Engine
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Learning Hub
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Smart daily commute practice and focused module drills.
          </p>
        </div>

        {streak > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Flame className="size-4 fill-amber-500 text-amber-500" />
            {streak} Day Study Streak
          </span>
        )}
      </div>

      {/* Primary Hero Card: Today's Learning */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary tracking-wide uppercase">
                <Sparkles className="size-3.5" /> Recommended Today
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Today’s Learning Plan
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                {hasDailyContent
                  ? "A balanced commute session blending your due spaced repetition, recent mistakes, and new topics."
                  : "Add words, synonym groups, or grammar topics to generate your tailored daily plan."}
              </p>
            </div>

            {hasDailyContent && (
              <div className="flex items-center gap-3">
                <StartDailyLearningButton
                  isActive={isDailyActive}
                  progressText={dailyProgressText}
                  size="lg"
                  className="shadow-sm"
                />
              </div>
            )}
          </div>

          {hasDailyContent && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-6">
              <div className="rounded-xl border bg-background/60 p-3 text-center sm:text-left">
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <BookOpen className="size-3.5 text-primary" /> Vocabulary
                </p>
                <p className="mt-1 text-xl font-bold">
                  {dailyPlan.vocabularyCount}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    items
                  </span>
                </p>
              </div>

              <div className="rounded-xl border bg-background/60 p-3 text-center sm:text-left">
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <Layers className="size-3.5 text-purple-500" /> Synonyms
                </p>
                <p className="mt-1 text-xl font-bold">
                  {dailyPlan.synonymsCount}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    items
                  </span>
                </p>
              </div>

              <div className="rounded-xl border bg-background/60 p-3 text-center sm:text-left">
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <Sparkles className="size-3.5 text-emerald-500" /> Grammar
                </p>
                <p className="mt-1 text-xl font-bold">
                  {dailyPlan.grammarCount}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    items
                  </span>
                </p>
              </div>

              <div className="rounded-xl border bg-background/60 p-3 text-center sm:text-left">
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                  <Clock className="size-3.5 text-amber-500" /> Est. Time
                </p>
                <p className="mt-1 text-xl font-bold">
                  ~{dailyPlan.estimatedMinutes}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    min
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Individual Modules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Individual Module Practice
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Vocabulary Module Card */}
          <Card className="flex flex-col justify-between overflow-hidden border">
            <div className="bg-secondary/50 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs font-semibold text-primary">
                  <BookOpen className="size-3.5" /> DAILY SPACED REPETITION
                </span>
                <span className="text-xs text-muted-foreground">
                  {vocabOverview.totalCount} words
                </span>
              </div>

              <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
                Today’s Review
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Single words, phrasal verbs, idioms, and definitions.
              </p>

              <div className="mt-6 grid grid-cols-3 divide-x border-t border-border/60 pt-4 text-center">
                <div>
                  <p className="text-xl font-bold text-primary sm:text-2xl">
                    {vocabOverview.dueCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Due</p>
                </div>
                <div>
                  <p className="text-xl font-bold sm:text-2xl">
                    {vocabOverview.newCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">New</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600 sm:text-2xl dark:text-amber-400">
                    {vocabOverview.difficultCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Difficult</p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex flex-wrap items-center justify-between gap-3">
              {hasVocab ? (
                <StartSessionButton
                  type="DAILY"
                  label="Start Learning"
                  className="w-full sm:w-auto"
                />
              ) : (
                <Button asChild size="sm">
                  <Link href="/vocabulary/new">
                    Add first word <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/vocabulary">Go to notebook</Link>
              </Button>
            </div>
          </Card>

          {/* Synonyms Module Card */}
          <Card className="flex flex-col justify-between overflow-hidden border">
            <div className="bg-secondary/50 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs font-semibold text-primary">
                  <Layers className="size-3.5" /> SYNONYMS
                </span>
                <span className="text-xs text-muted-foreground">
                  {synonymOverview.totalCount} groups
                </span>
              </div>

              <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
                Synonym Practice
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nuanced synonym clusters, multi-answer checks, and match games.
              </p>

              <div className="mt-6 grid grid-cols-3 divide-x border-t border-border/60 pt-4 text-center">
                <div>
                  <p className="text-xl font-bold text-primary sm:text-2xl">
                    {synonymOverview.dueCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Due</p>
                </div>
                <div>
                  <p className="text-xl font-bold sm:text-2xl">
                    {synonymOverview.newCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">New</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600 sm:text-2xl dark:text-amber-400">
                    {synonymOverview.difficultCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Difficult</p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex flex-wrap items-center justify-between gap-3">
              {hasSynonyms ? (
                <StartSynonymSessionButton
                  type="DAILY"
                  label={
                    synonymOverview.dueCount > 0
                      ? "Practice Synonyms"
                      : "Practice Synonyms"
                  }
                  className="w-full sm:w-auto"
                />
              ) : (
                <Button asChild size="sm">
                  <Link href="/synonyms/new">
                    Add first group <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/learn/synonyms">Synonym Hub</Link>
              </Button>
            </div>
          </Card>

          {/* Grammar Module Card */}
          <Card className="flex flex-col justify-between overflow-hidden border">
            <div className="bg-secondary/50 p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" /> GRAMMAR
                </span>
                <span className="text-xs text-muted-foreground">
                  {grammarOverview.totalTopics} topics
                </span>
              </div>

              <h2 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
                Grammar Practice
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Topic exercises, multiple-choice, fill blanks, and mistake
                tracking.
              </p>

              <div className="mt-6 grid grid-cols-3 divide-x border-t border-border/60 pt-4 text-center">
                <div>
                  <p className="text-xl font-bold text-primary sm:text-2xl">
                    {grammarOverview.needsPracticeCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Due</p>
                </div>
                <div>
                  <p className="text-xl font-bold sm:text-2xl">
                    {grammarOverview.difficultCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Difficult</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600 sm:text-2xl dark:text-amber-400">
                    {grammarOverview.mistakesCount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Mistakes</p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex flex-wrap items-center justify-between gap-3">
              {hasGrammar ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/learn/grammar">
                    Practice Grammar <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/grammar/new">
                    Add first topic <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/grammar">Go to notebook</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Targeted Modes Links */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Targeted Practice Modes
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-4" />
              </div>
              <h3 className="font-semibold text-sm">Vocabulary Due</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Matured spaced repetition words.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t">
              <StartSessionButton
                type="DUE"
                label="Review Due"
                variant="outline"
                size="sm"
                className="w-full text-xs"
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-4" />
              </div>
              <h3 className="font-semibold text-sm">New Vocabulary</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Recently added words to memorize.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t">
              <StartSessionButton
                type="NEW"
                label="Practice New"
                variant="outline"
                size="sm"
                className="w-full text-xs"
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </div>
              <h3 className="font-semibold text-sm">Synonyms Due</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Matured synonym groups for recall.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t">
              <StartSynonymSessionButton
                type="DUE"
                label="Review Due"
                variant="outline"
                size="sm"
                className="w-full text-xs"
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="size-4" />
              </div>
              <h3 className="font-semibold text-sm">Difficult Items</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Challenging words and past slips.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t">
              <StartSessionButton
                type="DIFFICULT"
                label="Practice Mistakes"
                variant="outline"
                size="sm"
                className="w-full text-xs"
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-4" />
              </div>
              <h3 className="font-semibold text-sm">Grammar Mistakes</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Targeted practice on missed exercises.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                <Link href="/learn/grammar/mistakes">Review Mistakes</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
