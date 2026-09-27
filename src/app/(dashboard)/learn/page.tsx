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
import { StartSessionButton } from "@/features/learning/components/start-session-button";
import { StartSynonymSessionButton } from "@/features/learning/components/start-synonym-session-button";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const [vocabOverview, synonymOverview, grammarOverview] = await Promise.all([
    getLearningOverview(),
    getSynonymLearningOverview(),
    getGrammarLearningOverview(),
  ]);

  const streak = Math.max(vocabOverview.streak, synonymOverview.streak);
  const hasVocab = vocabOverview.totalCount > 0;
  const hasSynonyms = synonymOverview.totalCount > 0;
  const hasGrammar = grammarOverview.totalTopics > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Interactive Learning Engine
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Today’s Review
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Smart spaced repetition adapts to your memory. Practice a few
            minutes daily.
          </p>
        </div>

        {streak > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Flame className="size-4 fill-amber-500 text-amber-500" />
            {streak} Day Study Streak
          </span>
        )}
      </div>

      {/* Overview Hub Cards */}
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
              Vocabulary Review
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
