import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  BookOpen,
  Layers,
  Flame,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { Types } from "mongoose";
import { vocabularyStats } from "@/services/vocabulary";
import { synonymStats } from "@/services/synonyms";
import { grammarStats } from "@/services/grammar";
import { getGrammarLearningOverview } from "@/services/grammar-learning";
import { calculateUserStreak } from "@/services/streak";
import { GrammarAttempt } from "@/models/grammar-attempt";
import { connectDB } from "@/lib/db/connect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GrammarCategoryBadge,
  GrammarStatusBadge,
} from "@/features/grammar/components/grammar-notebook";

export const metadata: Metadata = {
  title: "Progress",
  description: "Track your learning progress across EnglishMate modules",
};

export default async function ProgressPage() {
  const user = await requireUser();
  const userObjectId = new Types.ObjectId(user.id);
  await connectDB();

  const [
    vocab,
    synonyms,
    grammar,
    grammarOverview,
    streak,
    totalGrammarAttempts,
    correctGrammarAttempts,
  ] = await Promise.all([
    vocabularyStats(),
    synonymStats(),
    grammarStats(),
    getGrammarLearningOverview(),
    calculateUserStreak(userObjectId),
    GrammarAttempt.countDocuments({ userId: userObjectId }),
    GrammarAttempt.countDocuments({ userId: userObjectId, isCorrect: true }),
  ]);

  const grammarAccuracy =
    totalGrammarAttempts > 0
      ? Math.round((correctGrammarAttempts / totalGrammarAttempts) * 100)
      : 0;

  // Identify most difficult topics: status === DIFFICULT or lowest accuracy with attempts
  const difficultTopics = grammarOverview.topics
    .filter(
      (t) =>
        t.status === "DIFFICULT" || (t.attemptsCount > 0 && t.accuracy < 75),
    )
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Mastery & Analytics
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Learning Progress
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear insights into your grammar accuracy, vocabulary retention, and
            study streak.
          </p>
        </div>

        {streak > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Flame className="size-4 fill-amber-500 text-amber-500" />
            <span>{streak} Day Unified Streak</span>
          </div>
        )}
      </div>

      {/* Grammar Progress Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Grammar Mastery
            </h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/learn/grammar">
              Grammar Hub <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Grammar Topics
            </p>
            <p className="text-3xl font-bold text-foreground">
              {grammar.totalTopics}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {grammar.learnedCount} marked learned
            </p>
          </Card>

          <Card className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Exercises Practiced
            </p>
            <p className="text-3xl font-bold text-primary">
              {totalGrammarAttempts}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Total interactive attempts
            </p>
          </Card>

          <Card className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Grammar Accuracy
            </p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalGrammarAttempts > 0 ? `${grammarAccuracy}%` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {correctGrammarAttempts} correct answers
            </p>
          </Card>

          <Card className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Needs Practice
            </p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {grammarOverview.needsPracticeCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {grammarOverview.mistakesCount} recent mistakes
            </p>
          </Card>
        </div>

        {/* Most Difficult Topics */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Challenging Topics
              </h3>
            </div>
            {difficultTopics.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/learn/grammar/mistakes">
                  View Missed Exercises
                </Link>
              </Button>
            )}
          </div>

          {difficultTopics.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500 opacity-80" />
              <p className="font-semibold text-foreground">
                All topics performing well!
              </p>
              <p className="mt-1">
                No grammar topics currently marked as DIFFICULT or below 75%
                accuracy.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {difficultTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <GrammarCategoryBadge category={topic.category} />
                      <GrammarStatusBadge status={topic.status} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {topic.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {topic.accuracy}%
                      </span>{" "}
                      <span className="text-muted-foreground">accuracy</span>
                      <p className="text-[10px] text-muted-foreground">
                        {topic.mistakesCount} mistakes
                      </p>
                    </div>

                    <Button asChild size="sm" variant="outline">
                      <Link href={`/learn/grammar/${topic.id}`}>Practice</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Vocabulary & Synonyms Summary */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Other Learning Modules
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Vocabulary Card */}
          <Card className="p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <BookOpen className="size-4" /> Vocabulary
                </span>
                <span className="text-xs text-muted-foreground">
                  {vocab.learned} learned
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {vocab.total} Total Words
              </h3>
              <p className="text-xs text-muted-foreground">
                Spaced repetition with {vocab.due} words due for review today.
              </p>
            </div>
            <div className="pt-2 border-t flex items-center justify-between">
              <Button asChild variant="outline" size="sm">
                <Link href="/vocabulary">Open Notebook</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/learn">Review Words</Link>
              </Button>
            </div>
          </Card>

          {/* Synonyms Card */}
          <Card className="p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Layers className="size-4" /> Synonyms
                </span>
                <span className="text-xs text-muted-foreground">
                  {synonyms.learned} learned
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {synonyms.total} Synonym Groups
              </h3>
              <p className="text-xs text-muted-foreground">
                Nuanced expression clusters with {synonyms.due} groups due.
              </p>
            </div>
            <div className="pt-2 border-t flex items-center justify-between">
              <Button asChild variant="outline" size="sm">
                <Link href="/synonyms">Open Notebook</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/learn/synonyms">Practice Groups</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
